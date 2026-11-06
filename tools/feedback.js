(function(root){
'use strict';
const destination='info@creditunionainews.com';
function compose({category,message,email=''}){
 if(!['problem','question','suggestion'].includes(category))throw Error('Choose a feedback category.');
 message=String(message).trim();email=String(email).trim();
 if(!message||message.length>1000)throw Error('Enter a message between 1 and 1,000 characters.');
 if(email.length>254||(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))||/[\r\n]/.test(email))throw Error('Enter a valid reply email or leave it blank.');
 const subject='CUAI ROI calculator: '+category;
 const body=`Category: ${category}\n\n${message}${email?'\n\nOptional reply email: '+email:''}\n\nSent about the free CUAI ROI calculator. No calculator values are attached.`;
 const uri='mailto:'+destination+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 if(uri.length>8000)throw Error('This message is too long for an email link. Shorten it or email '+destination+' directly.');
 return {uri,body,subject,destination};
}
if(typeof module!=='undefined')module.exports={compose,destination};
if(typeof document!=='undefined'){
 const form=document.getElementById('feedback-form');if(!form)return;
 const link=document.getElementById('feedback-email-link'),status=document.getElementById('feedback-status');let draft=null;
 form.addEventListener('input',()=>{draft=null;link.hidden=true;status.textContent='';});
 form.addEventListener('submit',e=>{e.preventDefault();try{draft=compose({category:form.elements.category.value,message:form.elements.message.value,email:form.elements.email.value});link.hidden=false;status.textContent='Email draft prepared. Use “Open email to send,” then review and send in your email app. Nothing has been submitted or delivered here. Your text stays below.';}catch(error){draft=null;status.textContent=error.message;link.hidden=true;}});
 // The message/email URI stays in this closure, never in an href/data attribute
 // that enhanced outbound-click measurement could serialize.
 link.addEventListener('click',()=>{if(!draft)return;try{root.open(draft.uri,'_self');status.textContent='Your email app was requested. Delivery is not confirmed. Review and send there; if it did not open, email info@creditunionainews.com directly. Your text is preserved here.';}catch{status.textContent='The email app could not be opened. Email info@creditunionainews.com directly, or try again. Your text is preserved here; nothing was delivered by this page.';}});
}
})(typeof window!=='undefined'?window:globalThis);
