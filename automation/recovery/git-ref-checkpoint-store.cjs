'use strict';
const crypto=require('node:crypto');

// Adapter for a dedicated non-main Git ref containing one checkpoint document.
// `cas(expectedSha, document)` must atomically reject a changed ref. Binding to
// a connector remains disabled until that behavior is proven in its runtime.
function gitRefCheckpointStore({read,cas,ownerId,ownerLive,casVerified=false}) {
  if(!casVerified || ![read,cas,ownerLive].every(fn=>typeof fn==='function') || !ownerId) throw Error('checkpoint_cas_unverified');
  const token=crypto.randomUUID();
  async function update(change) {
    const current=await read();
    if(!current || !current.sha || !current.document) throw Error('checkpoint_snapshot_missing');
    const tx=crypto.randomUUID();
    const next=structuredClone(current.document);
    change(next);
    next.appliedTransactions=[...(next.appliedTransactions||[]),tx].slice(-100);
    try { await cas(current.sha,next); }
    catch(error) {
      // The write may have succeeded while its response was lost. Inspect the
      // authoritative ref; never blindly repeat an uncertain mutation.
      const observed=await read();
      if(!observed.document.appliedTransactions?.includes(tx)) throw error;
    }
    const observed=await read();
    if(!observed.document.appliedTransactions?.includes(tx)) throw Error('checkpoint_write_unconfirmed');
  }
  return {
    async acquire(key) {
      const before=await read();
      const held=before.document.leases?.[key];
      if(held && (await ownerLive(held.ownerId))!==false) throw Object.assign(Error('recovery_lease_busy'),{code:'LEASE_BUSY'});
      await update(doc=>{
        const lease=doc.leases?.[key];
        if(lease && lease.token!==held?.token) throw Error('checkpoint_lease_changed');
        doc.leases={...doc.leases,[key]:{ownerId,token}};
      });
      const observed=await read();
      if(observed.document.leases?.[key]?.token!==token) throw Error('recovery_lease_lost');
      return async()=>update(doc=>{
        if(doc.leases?.[key]?.token!==token) throw Error('recovery_lease_lost');
        delete doc.leases[key];
      });
    },
    async load(key) { const snapshot=await read(); return structuredClone(snapshot.document.states?.[key]||null); },
    async save(state) {
      await update(doc=>{
        if(doc.leases?.[state.key]?.token!==token) throw Error('recovery_lease_lost');
        doc.states={...doc.states,[state.key]:structuredClone(state)};
      });
    }
  };
}
module.exports={gitRefCheckpointStore};
