#!/usr/bin/env node
const {resolvePolicy}=require('../lib/operational-policy.cjs');
try{console.log(JSON.stringify(resolvePolicy(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
