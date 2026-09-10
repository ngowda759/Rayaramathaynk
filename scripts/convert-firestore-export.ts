#!/usr/bin/env npx tsx
/**
 * Convert a Firestore export (NDJSON one doc per line( into review-friendly JSON.
 * Writes data/firestore-dump/<collection>.json plus MANIFEST.json. Behaves as
 * a safety check: code-known collections that are missing fail the run. Auth
 * collections (users/profiles/bookmarks/sessions( are excluded: Firebase Auth
 * owns user records so they are not part of the migration. All other collections
 * present in the export are dumped regardless of whether code knows them. */
import * as fs from "fs";
import * as path from "path";
import {convertDoc,FirestoreWireDoc} from "./lib/firestore-values";

const ROOT=process.cwd();
const EXPECTED:ReadonlyArray<string>=[
  "aaradhane","aaradhanes","announcements","events","gallery","galleryAlbums","galleryMedia",
  "homepage","timings","sevas","testimonials","temple_areas","dailyPoojas","poojas",
  "panchanga","quotes","featuredContent","settings","futurePlans","trustCommittee","trust",
  "sevaBookings","donations","donationCampaigns","donation_campaigns","bills","receiptSevas",
  "receipts","system","volunteers","volunteer_requests","members","ai_settings","ai_token_usage",
  "ai_latency_records","ai_intent_distribution","ai_unknown_questions","chat_sessions","chat_messages",
  "messages","chatTraining","chat_metrics","intent_metrics","intent_feedback","unknown_questions",
  "page_views","daily_page_stats","feedback","notifications","knowledge","knowledge_articles",
  "knowledge_categories","knowledge_workflow","knowledge_versions","knowledge_workflow_actions",
  "knowledge_review_comments","knowledge_committee_approvals","knowledge_audit_log","knowledge_drafts",
];
const EXCLUDED:ReadonlyArray<string>=["users","profiles","bookmarks","sessions"];

function args(argv:string[]):{ed:string;dd:string;proj:string}{
  let ed=path.join(ROOT,"data","firestore-export"),dd=path.join(ROOT,"data","firestore-dump"),proj=process.env.FIREBASE_PROJECT_ID||"sri-raghavendra-mutt";
  for(let i=0;i<argv.length;i++){
    if(argv[i]=="--project"){proj=argv[++i];continue;}
    if(argv[i]=="--export-dir"){ed=argv[++i];continue;}
    if(argv[i]=="--dump-dir"){dd=argv[++i];continue;}
  }
  return{ed,dd,proj};
}
const {ed,dd,proj}=args(process.argv.slice(2));

const files=fs.readdirSync(ed)||[];
const present=new Map<string,number>();
for(const f of files.filter((x)=>x.endsWith(".ndjson"))){
  const lines=fs.readFileSync(path.join(ed,f),"utf8").split(String.fromCharCode(10)).filter(Boolean);
  const docs=lines.map((l)=>convertDoc(JSON.parse(l)as FirestoreWireDoc));
  const c=path.basename(f,".ndjson");
  if(EXCLUDED.includes(c))continue;
  fs.writeFileSync(path.join(dd,c+".json"),JSON.stringify(docs,null,2)+String.fromCharCode(10));
  present.set(c,docs.length);
}

const collections:any[]=[];
let totalDocs=0;
for(const [c,n]of present){
  collections.push({collection:c,status:"present",docCount:n,file:c+".ndjson"});
  totalDocs+=n;
}
const missing:Array<string>=[];
for(const c of EXPECTED)if(!present.has(c)&&!EXCLUDED.includes(c))missing.push(c);
for(const c of missing)collections.push({collection:c,status:"expected-known-missing",docCount:0,file:null,reason:"Known from code/rules but missing from export: verify empty"});
for(const c of EXCLUDED)if(present.has(c))collections.push({collection:c,status:"intentionallyExcluded",docCount:present.get(c),file:c+".ndjson",reason:"Auth-related: handled by Firebase Auth, excluded from migration"});
for(const [c,n]of present)if(!EXPECTED.includes(c)&&!EXCLUDED.includes(c))collections.push({collection:c,status:"unexpected",docCount:n,file:c+".ndjson",reason:"Not in code/rules: verify"});

fs.mkdirSync(dd,{recursive:true});
fs.writeFileSync(path.join(dd,"MANIFEST.json"),JSON.stringify({exportedAt:new Date().toISOString(),project:proj,totalCollections:present.size,totalDocs,collections},null,2)+String.fromCharCode(10));;

if(missing.length){
  console.error("FAIL: expected-known collections missing from export: "+missing.join(", "));
  process.exitCode=1;
}else{
  console.log("All "+EXPECTED.length+" expected-known collections accounted for.");
}
console.log("Converted "+present.size+" collections, "+totalDocs+" docs, into "+dd);
