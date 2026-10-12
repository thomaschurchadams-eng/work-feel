'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Local durable adapter for workers sharing one filesystem and host. Never
// reclaim a lock from another host or a live PID based on elapsed time alone.
function fileStore(directory) {
  const name = key => crypto.createHash('sha256').update(key).digest('hex');
  const statePath = key => path.join(directory, `${name(key)}.json`);
  const owner = () => ({host:os.hostname(),pid:process.pid,token:crypto.randomUUID()});
  const alive = record => {
    if (record.host !== os.hostname() || !Number.isInteger(record.pid) || record.pid < 1) return true;
    try { process.kill(record.pid,0); return true; }
    catch(error) { return error.code !== 'ESRCH'; }
  };
  async function readOwner(lock) {
    try { return JSON.parse(await fs.readlink(lock)); }
    catch(error) { if(error.code==='ENOENT') return null; throw error; }
  }
  async function reclaim(lock, reaper) {
    const reaperOwner=owner();
    try { await fs.symlink(JSON.stringify(reaperOwner),reaper); }
    catch(error) { if(error.code==='EEXIST') return; throw error; }
    try {
      const before=await readOwner(lock);
      if (!before || alive(before)) return;
      const again=await readOwner(lock);
      if (!again || again.token!==before.token || alive(again)) return;
      await fs.unlink(lock); // reaper is exclusive; other acquirers wait for it.
    } finally {
      const current=await readOwner(reaper);
      if (current?.token===reaperOwner.token) await fs.unlink(reaper);
    }
  }
  return {
    async acquire(key) {
      await fs.mkdir(directory,{recursive:true});
      const lock=path.join(directory,`${name(key)}.lock`),reaper=`${lock}.reaper`;
      for(let attempt=0;attempt<200;attempt++) {
        const sweeping=await readOwner(reaper);
        if(sweeping) {
          // A dead reaper is a separate incident: do not remove it without a
          // stronger transactional store. A live reaper finishes promptly.
          await sleep(10); continue;
        }
        const mine=owner();
        try {
          await fs.symlink(JSON.stringify(mine),lock);
          // Recheck to avoid entering while a concurrent reaper is active.
          if(await readOwner(reaper)) { await fs.unlink(lock); await sleep(10); continue; }
          return async()=>{ const current=await readOwner(lock); if(current?.token!==mine.token) throw Error('recovery_lease_lost'); await fs.unlink(lock); };
        } catch(error) {
          if(error.code!=='EEXIST') throw error;
          await reclaim(lock,reaper);
          await sleep(10);
        }
      }
      throw Object.assign(Error('recovery_lease_busy'),{code:'LEASE_BUSY'});
    },
    async load(key) {
      try { return JSON.parse(await fs.readFile(statePath(key),'utf8')); }
      catch(error) { if(error.code==='ENOENT') return null; throw error; }
    },
    async save(state) {
      const dest=statePath(state.key),tmp=`${dest}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(tmp,`${JSON.stringify(state)}\n`,{flag:'wx'});
      try { await fs.rename(tmp,dest); } finally { await fs.rm(tmp,{force:true}); }
    }
  };
}
module.exports={fileStore};
