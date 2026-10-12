const { authorize } = require('../lib/operations-auth');
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  if (!await authorize(req,res))return;
  return res.status(200).json({ok:true,commit:process.env.VERCEL_GIT_COMMIT_SHA||null,environment:process.env.VERCEL_ENV||null});
};
