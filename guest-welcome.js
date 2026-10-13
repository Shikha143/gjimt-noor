
"use strict";

/* =========================================
   GJIMT NOOR - GUEST WELCOME
   Tablet-compatible voice and slideshow
========================================= */

const guests = [
  {
    name: "Captain Mantej Singh Cheema",
    honorific: "Sir",
    designation: "Assistant Director of Youth Services, Mohali"
  },
  {
    name: "J.S. Bedi",
    honorific: "Sir",
    designation: "Chairman, GJIMT"
  },
  {
    name: "Dr. Aneet Bedi",
    honorific: "Ma'am",
    designation: "Director, GJIMT"
  }
];

const slides = [
  ...document.querySelectorAll(".guest-slide")
];

const halo = document.querySelector(".halo");
const line = document.getElementById("line");
const alertBox = document.getElementById("guestAlert");
const progress = document.getElementById("guestProgress");

const MIN_SLIDE_MS = 18000;

let current = 0;
let token = 0;
let slideStart = 0;
let slideTimer = null;
let voiceTimer = null;
let speechTimer = null;

let noorStopped = false;
let audioEnabled = true;
let speechBlocked = false;
let activeUtterance = null;

let ctx = null;
let musicTimer = null;

const GUEST_AUDIO_KEY = "noorGuestAudioOwnerV1";
const GUEST_AUDIO_TTL = 6000;

const guestOwnerId =
  "guest-" + Date.now() + "-" +
  Math.random().toString(36).slice(2);

let guestHeartbeat = null;

/* =========================================
   AUDIO PRIORITY
========================================= */

function claimGuestAudio() {
  if (document.hidden || noorStopped) return;

  try {
    localStorage.setItem(
      GUEST_AUDIO_KEY,
      JSON.stringify({
        id: guestOwnerId,
        expires: Date.now() + GUEST_AUDIO_TTL
      })
    );
  } catch (error) {
    console.warn("Audio priority:", error);
  }
}

function releaseGuestAudio() {
  try {
    const state = JSON.parse(
      localStorage.getItem(GUEST_AUDIO_KEY) || "null"
    );

    if (state && state.id === guestOwnerId) {
      localStorage.removeItem(GUEST_AUDIO_KEY);
    }
  } catch (error) {}
}

function startGuestPriority() {
  claimGuestAudio();

  clearInterval(guestHeartbeat);

  guestHeartbeat = setInterval(
    claimGuestAudio,
    2000
  );
}

function stopGuestPriority() {
  clearInterval(guestHeartbeat);
  guestHeartbeat = null;
  releaseGuestAudio();
}

window.addEventListener(
  "pagehide",
  stopGuestPriority
);

/* =========================================
   FEMALE VOICE - TABLET COMPATIBLE
========================================= */

function preferredVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = speechSynthesis.getVoices() || [];

  if (!voices.length) return null;

  const preferred = [
    "Microsoft Neerja",
    "Microsoft Heera",
    "Microsoft Swara",
    "Google हिन्दी",
    "Google Hindi",
    "Veena",
    "Lekha",
    "Google UK English Female",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Microsoft Zira"
  ];

  for (const name of preferred) {
    const found = voices.find(v =>
      v.name.toLowerCase().includes(
        name.toLowerCase()
      )
    );

    if (found) return found;
  }

  // Same fallback approach as Dashboard.
  // The default voice's gender depends on
  // the tablet's installed speech engine.

  return (
    voices.find(v =>
      /^(hi|en)[-_ ]?IN/i.test(v.lang) &&
      /female|woman|neerja|heera|swara|veena|lekha/i
        .test(v.name)
    ) ||
    voices.find(v =>
      /female|woman|neerja|heera|swara|veena|lekha|samantha|karen|zira/i
        .test(v.name)
    ) ||
    voices.find(v =>
      /^hi[-_ ]?IN/i.test(v.lang)
    ) ||
    voices.find(v =>
      /^en[-_ ]?IN/i.test(v.lang)
    ) ||
    voices.find(v => v.default) ||
    voices[0] ||
    null
  );
}

/* =========================================
   PRONUNCIATION
========================================= */

function sayable(text) {
  return String(text)
    .replace(/GJIMT/gi, "G J I M T")
    .replace(/Gian Jyoti/gi, "Gyaan Jyoti")
    .replace(/Sat Shri Akal/gi, "Sat Shree Akaal")
    .replace(/Sat Sri Akal/gi, "Sat Shree Akaal");
}

/* =========================================
   THREE GUEST ANNOUNCEMENTS
========================================= */

function welcomeParts(guest) {

  if (guest.name === "Captain Mantej Singh Cheema") {
    return [
      "Sat Shri Akal!",
      "NOOR warmly welcomes Captain Mantej Singh Cheema Sir.",
      "Captain Mantej Singh Cheema Sir is Assistant Director of Youth Services, Mohali.",
      "Welcome to the Gian Jyoti Blood Donation Camp.",
      "Thank you for your presence and support."
    ];
  }

  if (guest.name === "J.S. Bedi") {
    return [
      "Sat Shri Akal!",
      "NOOR is honoured to greet the esteemed Chairman of G J I M T, J.S. Bedi Sir.",
      "Welcome to the Gian Jyoti Blood Donation Camp.",
      "Thank you for your presence and support."
    ];
  }

  if (guest.name === "Dr. Aneet Bedi") {
    return [
      "Sat Shri Akal!",
      "NOOR warmly welcomes the Director of G J I M T, Dr. Aneet Bedi Ma'am.",
      "Welcome to the Gian Jyoti Blood Donation Camp.",
      "Thank you for your presence and support."
    ];
  }

  return [];
}

/* =========================================
   BACKGROUND MUSIC
========================================= */

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function startMusic() {
  if (
    noorStopped ||
    !audioEnabled ||
    !ctx ||
    ctx.state !== "running" ||
    musicTimer
  ) return;

  let n = 0;

  const chords = [
    [261.63, 329.63, 392],
    [293.66, 369.99, 440],
    [329.63, 392, 493.88]
  ];

  function play() {
    if (
      !ctx ||
      ctx.state !== "running" ||
      noorStopped
    ) return;

    const t = ctx.currentTime + 0.03;

    const chord = chords[n++ % chords.length];

    chord.forEach((frequency, j) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(
        0.0001,
        t + j * 0.06
      );

      gain.gain.exponentialRampToValueAtTime(
        0.015,
        t + j * 0.06 + 0.18
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        t + j * 0.06 + 3
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(t + j * 0.06);
      oscillator.stop(t + j * 0.06 + 3.05);
    });
  }

  play();

  musicTimer = setInterval(play, 3300);
}

function tryMusic() {
  if (noorStopped || !audioEnabled) return;

  try {
    const AudioClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioClass) return;

    ctx = ctx || new AudioClass();

    if (ctx.state === "suspended") {
      ctx.resume()
        .then(startMusic)
        .catch(() => {});
    } else {
      startMusic();
    }
  } catch (error) {
    console.warn("Music unavailable:", error);
  }
}

/* =========================================
   CLEAR SPEECH
========================================= */

function clearSpeech() {
  clearTimeout(voiceTimer);
  clearTimeout(speechTimer);

  voiceTimer = null;
  speechTimer = null;
  activeUtterance = null;

  if ("speechSynthesis" in window) {
    try {
      speechSynthesis.cancel();
    } catch (error) {}
  }

  halo?.classList.remove("talking");
}

/* =========================================
   NEXT SLIDE
========================================= */

function scheduleNext(id) {
  clearTimeout(slideTimer);

  const remaining = Math.max(
    1300,
    MIN_SLIDE_MS - (Date.now() - slideStart)
  );

  slideTimer = setTimeout(() => {
    if (id === token) {
      show((current + 1) % guests.length);
    }
  }, remaining);
}

/* =========================================
   NOOR SPEECH ENGINE
========================================= */

function speak(id){
  const guest=guests[current];
  const message=welcomeParts(guest).join(' ');
  if(line)line.textContent=message;
  if(alertBox)alertBox.textContent='♥ NOOR greets '+guest.name+' '+guest.honorific+'!';
  stopMusic();
  if(noorStopped||!audioEnabled){scheduleNext(id);return}
  let finished=false;
  const finish=()=>{if(finished||id!==token)return;finished=true;halo?.classList.remove('talking');tryMusic();scheduleNext(id)};
  window.NOORAudio.say(sayable(message),{
    start:()=>{if(id===token){speechBlocked=false;halo?.classList.add('talking')}},
    end:finish,
    error:e=>{if(id!==token)return;speechBlocked=true;if(alertBox)alertBox.textContent='Tap Repeat / Resume NOOR — '+e;finish()}
  });
}

/* =========================================
   SHOW GUEST
========================================= */

function show(index) {
  current =
    (index + guests.length) %
    guests.length;

  token++;
  slideStart = Date.now();

  clearTimeout(slideTimer);
  clearSpeech();
  stopMusic();

  slides.forEach((slide, i) => {
    slide.classList.toggle(
      "active",
      i === current
    );

    slide.setAttribute(
      "aria-hidden",
      String(i !== current)
    );
  });

  if (progress) {
    progress.textContent =
      `Guest ${current + 1} of ${guests.length}`;
  }

  speak(token);
}

/* =========================================
   REPEAT / RESUME NOOR
========================================= */

function resumeNoor() {
  noorStopped = false;
  audioEnabled = true;
  speechBlocked = false;

  startGuestPriority();
  window.NOORAudio.musicUnlock().then(r=>{if(r.context){ctx=r.context;tryMusic()}});

  if ("speechSynthesis" in window) {
    try {
      speechSynthesis.cancel();
      speechSynthesis.resume();
      speechSynthesis.getVoices();
    } catch (error) {}
  }

  // This runs after the user's tap,
  // which helps unlock tablet audio.
  // Start speech directly inside the user's tap event.
  show(current);
}

/* =========================================
   PREVIOUS GUEST BUTTON
========================================= */

document.getElementById("prevGuest")
  ?.addEventListener("click", () => {
    show(current - 1);
  });

/* =========================================
   NEXT GUEST BUTTON
========================================= */

document.getElementById("nextGuest")
  ?.addEventListener("click", () => {
    show(current + 1);
  });

/* =========================================
   REPEAT BUTTON
========================================= */

document.getElementById("repeatWelcome")
  ?.addEventListener(
    "click",
    resumeNoor
  );

/* =========================================
   STOP NOOR BUTTON
========================================= */

document.getElementById("stopNoor")
  ?.addEventListener("click", () => {
    noorStopped = true;
    audioEnabled = false;

    stopGuestPriority();

    token++;

    clearSpeech();
    stopMusic();

    if (ctx?.state === "running") {
      ctx.suspend().catch(() => {});
    }

    if (alertBox) {
      alertBox.textContent =
        "NOOR stopped • Guest slideshow continues";
    }

    scheduleNext(token);
  });

/* =========================================
   PAGE VISIBILITY
========================================= */

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) {
      stopGuestPriority();

      token++;

      clearSpeech();
      stopMusic();
      clearTimeout(slideTimer);
    } else {
      if (!noorStopped) {
        startGuestPriority();
      }

      show(current);
    }
  }
);

/* =========================================
   TABLET TAP-TO-ENABLE FALLBACK
========================================= */

document.addEventListener(
  "pointerdown",
  event => {
    if (
      document.hidden ||
      noorStopped ||
      !speechBlocked
    ) return;

    const target = event.target;

    if (
      target instanceof Element &&
      target.closest(
        "#stopNoor, #repeatWelcome, #prevGuest, #nextGuest, a"
      )
    ) return;

    resumeNoor();
  },
  { passive: true }
);

/* =========================================
   INITIALIZE VOICES
========================================= */

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();

  speechSynthesis.addEventListener?.(
    "voiceschanged",
    () => {
      console.log(
        "NOOR voices loaded:",
        speechSynthesis.getVoices().length
      );
    }
  );
}

/* =========================================
   AUTOMATIC WELCOME
========================================= */

function autoWelcome() {
  startGuestPriority();
  window.NOORAudio.musicUnlock().then(r=>{if(r.context){ctx=r.context;tryMusic()}});

  if ("speechSynthesis" in window) {
    try {
      speechSynthesis.getVoices();
      speechSynthesis.resume();
    } catch (error) {}
  }

  show(0);
}

/* =========================================
   START PAGE
========================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    autoWelcome,
    { once: true }
  );
} else {
  autoWelcome();
}
