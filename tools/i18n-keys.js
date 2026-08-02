const fs=require('fs');const s=fs.readFileSync('api/public/i18n.js','utf8');
const i=s.indexOf('var T = {');let d=0,j=s.indexOf('{',i);const st=j;
do{if(s[j]==='{')d++;else if(s[j]==='}')d--;j++;}while(d>0);
const T=eval('('+s.slice(st,j)+')');
fs.writeFileSync(process.argv[2],JSON.stringify(Object.keys(T.hr)));
