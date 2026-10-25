// 一个服务同时提供网页与 AI API。密钥只在这里读取，不会打包到浏览器。
import http from 'node:http';
import fs from 'node:fs/promises';
import {createServer,loadEnv} from 'vite';
import {parseOnline} from './lib/ai.mjs';
import {validDate} from './lib/flow.mjs';
const config={...loadEnv('development',process.cwd(),''),...process.env};
const port=Number(config.PORT||5173);
const origin=`http://localhost:${port}`;
const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
const server=http.createServer(async(req,res)=>{
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(req.url==='/api/config')return reply(200,{aiConfigured:!!config.CAMPUSFLOW_AI_KEY});
 if(req.url==='/api/parse'){
  if(req.method!=='POST')return reply(405,{error:'请使用POST'});
  if(req.headers.origin!==origin)return reply(403,{error:'仅接受本机网页请求'});
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65000)return reply(413,{error:'请求过大'});}
   const {text,referenceDate}=JSON.parse(raw);
   if(typeof text!=='string'||!text.trim()||text.length>12000||!validDate(referenceDate)||referenceDate.length!==10)return reply(400,{error:'通知或日期无效'});
   const result=await parseOnline({text,referenceDate,key:config.CAMPUSFLOW_AI_KEY,model:config.CAMPUSFLOW_AI_MODEL});return reply(200,result);
  }catch(e){return reply(e.message==='AI_NOT_CONFIGURED'?503:502,{error:e.message==='AI_NOT_CONFIGURED'?'尚未配置在线 AI，请使用本地解析。':'AI请求或结果核验失败，未创建任务。'});}
 }
 vite.middlewares(req,res,()=>{res.statusCode=404;res.end('Not found');});
});
server.listen(port,'127.0.0.1',()=>console.log(`CampusFlow: ${origin} (Ctrl+C to stop)`));
