const API='https://catalog.disaster.go.th/api/3/action/datastore_search_sql';
export default async function handler(req,res){
  try{
    const sql='SELECT "province", count(*) AS cnt FROM "27e81e82-7cdc-4fe9-94b9-f3ca193c2328" GROUP BY "province" ORDER BY "province"';
    const u=new URL(API);u.searchParams.set('sql',sql);
    const r=await fetch(u,{headers:{'User-Agent':'ThaiFlood-Intelligence/7.0'}});
    const text=await r.text();
    res.status(r.status).setHeader('content-type','application/json; charset=utf-8').send(text);
  }catch(e){res.status(500).json({ok:false,error:e.message});}
}
