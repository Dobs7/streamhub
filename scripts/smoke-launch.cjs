const {spawn}=require('node:child_process');
const path=require('node:path');
const exe=path.resolve(process.argv[2]||'node_modules/electron/dist/electron.exe');
const output=path.resolve(process.argv[3]||'output/0.4-source');
const child=spawn(exe,process.argv[2]?[]:['.'],{windowsHide:true,env:{...process.env,STREAMHUB_SMOKE:'1',STREAMHUB_SMOKE_OUTPUT:output},stdio:'pipe'});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
const timeout=setTimeout(()=>{console.error('Smoke excedeu 60 segundos.');child.kill();process.exitCode=1;},60000);
child.on('error',e=>{clearTimeout(timeout);console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timeout);console.log('Smoke exit:',code,'output:',output);process.exitCode=code||0;});
