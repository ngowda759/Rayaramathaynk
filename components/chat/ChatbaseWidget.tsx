"use client";

import Script from "next/script";

export default function ChatbaseWidget() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
    return null;
  }

  return (
    <Script
      id="chatbase-widget"
      strategy="lazyOnload"
    >
      {`(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="${chatbotId}";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();`}
    </Script>
  );
}
