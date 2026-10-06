// Local read-only PostgREST fixture backed by a real migrated PostgreSQL (PGlite).
// For visual/integration verification only; never deployed.
import http from 'node:http';
import { cyberDatabase, CYBER_MIGRATION, BUSINESS_ID } from './cyber-database.ts';
const db = await cyberDatabase();
await db.exec(CYBER_MIGRATION);
const server = http.createServer(async (req,res) => {
  res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405);res.end('{}');return; }
  try {
    const url = new URL(req.url!, 'http://localhost');
    const table = url.pathname.split('/').pop()!;
    let rows:any[] = [];
    if (table==='business_units') rows=[{id:BUSINESS_ID,name:'La Manito del Vegano',slug:'la-manito-del-vegano',agent_enabled:false}];
    else if (table==='ajustes') rows=[{id:'global',data:{estado:'abierto',remy_web_visible:false}}];
    else if (table==='integraciones_secretas') rows=[{}];
    else if (table==='categorias') rows=[{id:'chocolateria',nombre:'Chocolatería',emoji:'🍫',slug:'dulces-chocolateria'}];
    else if (['zonas','blocked_delivery_dates'].includes(table)) rows=[];
    else if (['productos','product_variants','product_option_groups','product_option_values','product_pack_components','seasons','season_products','season_variant_overrides'].includes(table)) rows=(await db.query(`select * from ${table}`)).rows;
    for (const [key,val] of url.searchParams) {
      if (val.startsWith('eq.')) rows=rows.filter(r=>String(r[key])===val.slice(3));
      if (val.startsWith('in.(')) {const values=val.slice(4,-1).split(',');rows=rows.filter(r=>values.includes(String(r[key])));}
    }
    const order=url.searchParams.get('order');if(order){const specs=order.split(',');rows.sort((a,b)=>{for(const spec of specs){const[k,d]=spec.split('.');if(a[k]!==b[k])return (a[k]<b[k]?-1:1)*(d==='desc'?-1:1);}return 0;});}
    if (table==='productos' && url.searchParams.get('select')?.includes('product_variants')) {
      for(const row of rows) {
        row.product_variants=(await db.query('select * from product_variants where product_id=$1',[row.id])).rows;
        row.product_option_groups=(await db.query('select * from product_option_groups where product_id=$1',[row.id])).rows;
        for(const g of row.product_option_groups) g.product_option_values=(await db.query('select * from product_option_values where option_group_id=$1',[g.id])).rows;
        row.product_pack_components=[];
      }
    }
    res.end(JSON.stringify(req.headers.accept?.includes('application/vnd.pgrst.object') ? rows[0]??null : rows));
  }catch(e){res.writeHead(500);res.end(JSON.stringify({message:String(e)}));}
});
server.listen(4891,'127.0.0.1',()=>process.stdout.write('Migrated Cyber fixture ready at 4891\n'));
