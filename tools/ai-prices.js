/* Published USD presets verified 2026-11-04 from the linked official sources.
   Editable estimates only. No billing account or actual usage is connected. */
window.AIPricePresets = {
 verified:'2026-11-04',
 subscriptions:[
  {id:'none',name:'No subscription',provider:'None',monthly:0,annual:0},
  {id:'chatgpt-free',provider:'ChatGPT',name:'Free',monthly:0,annual:0,source:'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus'},
  {id:'chatgpt-plus',provider:'ChatGPT',name:'Plus',monthly:20,annual:null,source:'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus'},
  ...[100,200,500].map(price=>({id:'chatgpt-pro-'+price,provider:'ChatGPT',name:'Pro $'+price,monthly:price,annual:null,source:'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers'})),
  {id:'chatgpt-business-standard',provider:'ChatGPT',name:'Business Standard',monthly:25,annual:240,minSeats:2,source:'https://help.openai.com/en/articles/8542115-chatgpt-business-general-faq'},
  {id:'chatgpt-business-premium',provider:'ChatGPT',name:'Business Premium',monthly:125,annual:1200,minSeats:2,source:'https://help.openai.com/en/articles/8542115-chatgpt-business-general-faq'},
  {id:'claude-free',provider:'Claude',name:'Free',monthly:0,annual:0,source:'https://claude.com/pricing'},
  {id:'claude-pro',provider:'Claude',name:'Pro',monthly:20,annual:200,source:'https://claude.com/pricing'},
  {id:'claude-max-5',provider:'Claude',name:'Max',monthly:100,annual:null,source:'https://claude.com/pricing'},
  {id:'claude-max-20',provider:'Claude',name:'Ultra',monthly:200,annual:null,source:'https://claude.com/pricing'},
  {id:'claude-team-standard',provider:'Claude',name:'Team Standard',monthly:25,annual:240,minSeats:2,maxSeats:150,source:'https://claude.com/pricing'},
  {id:'claude-team-premium',provider:'Claude',name:'Team Premium',monthly:125,annual:1200,minSeats:2,maxSeats:150,source:'https://claude.com/pricing'},
  {id:'custom',provider:'Custom',name:'Enterprise / custom quote',monthly:null,annual:null}
 ],
 models:[
  {id:'none',name:'No API usage',input:0,output:0,cached:0},
  {id:'gpt-6-luna',name:'OpenAI GPT-6 Luna',input:.10,output:.50,cached:.01,source:'https://developers.openai.com/api/docs/pricing',condition:'Standard speed, short context.'},
  {id:'gpt-6-1-sol',name:'OpenAI GPT-6.1 Sol',input:2,output:10,cached:.10,source:'https://developers.openai.com/api/docs/pricing',condition:'Standard speed, short context.'},
  {id:'gpt-6-astra',name:'OpenAI GPT-6 Astra',input:10,output:50,cached:1,source:'https://developers.openai.com/api/docs/pricing',condition:'Standard speed, short context.'},
  {id:'claude-haiku-5-5-short',name:'Claude Haiku 5.5 · input ≤100k/request',input:.10,output:.50,cached:.01,source:'https://platform.claude.com/docs/en/about-claude/pricing',condition:'Each request has at most 100,000 input tokens.'},
  {id:'claude-haiku-5-5-long',name:'Claude Haiku 5.5 · input >100k/request',input:.50,output:2.50,cached:.05,source:'https://platform.claude.com/docs/en/about-claude/pricing',condition:'Each request has more than 100,000 input tokens. Mixed traffic needs a weighted custom rate.'},
  {id:'claude-sonnet-5-5',name:'Claude Sonnet 5.5',input:2,output:10,cached:.10,source:'https://platform.claude.com/docs/en/about-claude/pricing',condition:'Standard token rates; verify context/service conditions.'},
  {id:'claude-opus-5-5',name:'Claude Opus 5.5',input:4,output:20,cached:.20,source:'https://platform.claude.com/docs/en/about-claude/pricing',condition:'Standard token rates; verify context/service conditions.'},
  {id:'custom',name:'Custom API rates',input:null,output:null,cached:null}
 ]
};
