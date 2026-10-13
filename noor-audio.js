/* Shared NOOR audio controller. Browser TTS needs a user gesture on many phones. */
(function(){
  const synth=window.speechSynthesis;
  let active=null;
  function voice(){
    if(!synth)return null;
    const vs=synth.getVoices()||[];
    const prefer=/neerja|heera|swara|veena|lekha|samantha|karen|moira|tessa|zira|female|woman|google hindi|google हिन्दी/i;
    return vs.find(v=>prefer.test(v.name)&&/^(hi|en)/i.test(v.lang)) ||
      vs.find(v=>/^en[-_]IN/i.test(v.lang)) || vs.find(v=>/^hi[-_]IN/i.test(v.lang)) ||
      vs.find(v=>/^en/i.test(v.lang)) || vs.find(v=>v.default) || vs[0] || null;
  }
  function say(text, callbacks={}){
    if(!synth||!window.SpeechSynthesisUtterance){callbacks.error?.('unsupported');return false;}
    try{
      synth.cancel();
      const u=new SpeechSynthesisUtterance(String(text));
      const v=voice();if(v){u.voice=v;u.lang=v.lang||'en-IN'}else{u.lang='en-IN'}
      u.rate=1.02;u.pitch=1.08;u.volume=1;
      let settled=false;
      const complete=(reason)=>{if(settled)return;settled=true;clearTimeout(watch);if(reason==='end')callbacks.end?.();else callbacks.error?.(reason)};
      u.onstart=()=>callbacks.start?.();
      u.onend=()=>complete('end');
      u.onerror=e=>complete(e.error||'speech error');
      active=u;
      const watch=setTimeout(()=>complete('speech timeout'),30000);
      synth.resume();synth.speak(u);
      return true;
    }catch(e){callbacks.error?.(e.message);return false}
  }
  function musicUnlock(){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return Promise.resolve({state:'unsupported'});
      const ctx=window.__noorUnlockContext || (window.__noorUnlockContext=new AC());
      // A silent oscillator within the actual tap handler unlocks iOS WebAudio.
      const osc=ctx.createOscillator(),g=ctx.createGain();g.gain.value=0.00001;
      osc.connect(g);g.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.04);
      return Promise.resolve(ctx.resume()).then(()=>({state:ctx.state,context:ctx})).catch(e=>({state:'error',error:String(e)}));
    }catch(e){return Promise.resolve({state:'error',error:String(e)})}
  }
  window.NOORAudio={say,voice,musicUnlock,stop(){try{synth?.cancel()}catch(e){}},supported:!!synth};
})();
