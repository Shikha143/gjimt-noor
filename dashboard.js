
"use strict";

/* ========================================
   NOOR PRONUNCIATION
======================================== */

function noorPronunciation(text) {
  return String(text)
    .replace(/Non\s+Gianjyotian/gi, "Non Gyaan Jyoti an")
    .replace(/Gianjyotian/gi, "Gyaan Jyoti an")
    .replace(/Gian\s+Jyoti/gi, "Gyaan Jyoti")
    .replace(/\bGian\b/gi, "Gyaan")
    .replace(/Sat Shri Akal/gi, "Sat Shree Akaal")
    .replace(/Sat Sri Akal/gi, "Sat Shree Akaal");
}

/* ========================================
   GOOGLE APPS SCRIPT API
======================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycbw02znnYysRZhE8FeYz040Gd11qk7d-MWa1ij0XIk2I_ikFCMUcgBkAvq2Tl3EOdb8Mfw/exec";

let loading = false;

function getStats() {
  return new Promise((resolve, reject) => {
    const cb =
      "dash_" + Date.now() + "_" +
      Math.floor(Math.random() * 1e6);

    const script = document.createElement("script");
    let done = false;

    const timer = setTimeout(
      () => finish(new Error("Timed out")),
      12000
    );

    function finish(error, value) {
      if (done) return;

      done = true;
      clearTimeout(timer);
      delete window[cb];
      script.remove();

      error ? reject(error) : resolve(value);
    }

    window[cb] = value =>
      finish(
        value.error ? new Error(value.error) : null,
        value
      );

    script.onerror = () =>
      finish(new Error("Network error"));

    script.src =
      API_URL +
      "?action=stats&callback=" + cb +
      "&_=" + Date.now();

    document.head.appendChild(script);
  });
}

async function refresh() {
  if (loading) return;

  loading = true;

  try {
    const stats = await getStats();

    if (!stats.ok) {
      throw Error(stats.error || "API error");
    }

    if (stats.apiVersion !== "NOOR-3BOX-V4") {
      throw Error(
        "Backend update required: deploy latest Code.gs as a NEW VERSION"
      );
    }

    document.getElementById("total").textContent =
      stats.total ?? 0;

    document.getElementById("gianCount").textContent =
      stats.gianjyotianCount ?? 0;

    document.getElementById("nonGianCount").textContent =
      stats.nonGianjyotianCount ?? 0;

    document.getElementById("sync").textContent =
      "● Google Sheet connected • Updated " +
      new Date().toLocaleTimeString("en-IN");

  } catch (error) {
    document.getElementById("sync").textContent =
      "⚠ " + error.message + " • Will retry";
  } finally {
    loading = false;
  }
}

refresh();
setInterval(refresh, 10000);

/* ========================================
   DONOR ANNOUNCEMENTS
======================================== */

let lastEventId = Number(
  sessionStorage.getItem("noorDashboardLastId") || 0
);

let initialized = false;
let polling = false;
let speaking = false;
let voiceReady = false;

const announcementQueue = [];

const alertBox = document.getElementById("donorAlert");
const lineBox = document.getElementById("line");
const halo = document.querySelector(".halo");

const DEFAULT_LINE =
  "Gian Jyoti Blood Donation Camp. Every donor brings hope and helps save lives.";

/* ========================================
   FIVE DIFFERENT THANK-YOU MESSAGES
======================================== */

const thankYouMessages = [

  name =>
    `Thank you ${name} for registering at the Gian Jyoti Blood Donation Camp. Your generous act can help save lives and bring hope to many families.`,

  name =>
    `A heartfelt thank you to ${name}. Your kindness and willingness to donate blood are truly inspiring. Your contribution can make a meaningful difference in someone's life.`,

  name =>
    `We warmly appreciate ${name} for joining the Gian Jyoti Blood Donation Camp. Your decision to help others reflects the true spirit of humanity and compassion.`,

  name =>
    `Thank you so much ${name}. Every drop of blood carries the promise of life. Your generous support brings hope, strength, and happiness to people in need.`,

  name =>
    `A big round of appreciation for ${name}. By participating in this blood donation camp, you have taken a wonderful step towards saving lives. Thank you for being a part of this noble cause.`

];

let thankYouIndex = Number(
  sessionStorage.getItem("noorThankYouIndex") || 0
) % thankYouMessages.length;

function getNextThankYouMessage(name) {
  const message = thankYouMessages[thankYouIndex](name);

  thankYouIndex =
    (thankYouIndex + 1) % thankYouMessages.length;

  sessionStorage.setItem(
    "noorThankYouIndex",
    String(thankYouIndex)
  );

  return message;
}

/* ========================================
   FEMALE VOICE SELECTION
======================================== */

function femaleVoice() {
  const voices =
    window.speechSynthesis?.getVoices() || [];

  if (!voices.length) return null;

  const preferred = [
    "Microsoft Neerja",
    "Microsoft Heera",
    "Microsoft Swara",
    "Google हिन्दी",
    "Google Hindi",
    "Veena",
    "Lekha",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Microsoft Zira"
  ];

  for (const name of preferred) {
    const voice = voices.find(v =>
      v.name.toLowerCase().includes(
        name.toLowerCase()
      )
    );

    if (voice) return voice;
  }

  return (
    voices.find(v =>
      /^(hi|en)[-_ ]?IN/i.test(v.lang) &&
      /female|woman|neerja|heera|swara|veena|lekha/i.test(v.name)
    ) ||
    voices.find(v =>
      /female|woman|neerja|heera|swara|veena|lekha|samantha|karen|zira/i.test(v.name)
    ) ||
    voices.find(v => /^hi[-_ ]?IN/i.test(v.lang)) ||
    voices.find(v => /^en[-_ ]?IN/i.test(v.lang)) ||
    voices.find(v => v.default) ||
    voices[0] ||
    null
  );
}

/* ========================================
   BACKGROUND MUSIC
======================================== */

let musicCtx = null;
let musicTimer = null;
let musicPlaying = false;
let audioUnlocked = false;

// Guest Welcome takes priority over donor announcements in other tabs.
const GUEST_AUDIO_KEY = "noorGuestAudioOwnerV1";
function guestWelcomeActive() {
  try {
    const state = JSON.parse(localStorage.getItem(GUEST_AUDIO_KEY) || "null");
    return !!(state && Number(state.expires) > Date.now());
  } catch (error) { return false; }
}

function enforceGuestPriority() {
  if (guestWelcomeActive() || document.hidden) {
    pauseLightMusic();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    halo?.classList.remove("talking");
    // Requeue an interrupted announcement rather than lose it.
    if (speaking && currentAnnouncement) {
      announcementQueue.unshift(currentAnnouncement);
      currentAnnouncement = null;
      speaking = false;
    }
  } else if (audioUnlocked) {
    if (!speaking) announceNext();
    if (!speaking) startLightMusic();
  }
}

let currentAnnouncement = null;
window.addEventListener("storage", event => {
  if (event.key === GUEST_AUDIO_KEY) enforceGuestPriority();
});
document.addEventListener("visibilitychange", enforceGuestPriority);
setInterval(enforceGuestPriority, 1500);


function playSoftNote(
  freq,
  when,
  duration = 2.8,
  volume = 0.050
) {
  if (!musicCtx) return;

  const oscillator = musicCtx.createOscillator();
  const gain = musicCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(freq, when);

  gain.gain.setValueAtTime(0.0001, when);

  gain.gain.exponentialRampToValueAtTime(
    volume,
    when + 0.18
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    when + duration
  );

  oscillator.connect(gain);
  gain.connect(musicCtx.destination);

  oscillator.start(when);
  oscillator.stop(when + duration + 0.05);
}

function startLightMusic() {
  if (!audioUnlocked || musicPlaying || guestWelcomeActive() || document.hidden) return;

  try {
    musicCtx =
      musicCtx ||
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    if (musicCtx.state === "suspended") {
      musicCtx.resume();
    }

    musicPlaying = true;

    const chords = [
      [261.63, 329.63, 392],
      [293.66, 369.99, 440],
      [329.63, 392, 493.88],
      [293.66, 349.23, 440]
    ];

    let i = 0;

    const playChord = () => {
      if (!musicPlaying || !musicCtx) return;

      const now = musicCtx.currentTime + 0.03;

      chords[i++ % chords.length].forEach(
        (freq, j) =>
          playSoftNote(
            freq,
            now + j * 0.06,
            3.4,
            0.030
          )
      );
    };

    playChord();
    musicTimer = setInterval(playChord, 3300);

  } catch (error) {
    console.warn("Soft music unavailable", error);
  }
}

function pauseLightMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  musicPlaying = false;
}

/* ========================================
   NOOR VOICE
======================================== */

function sayDashboard(message,onFinish){
  if(guestWelcomeActive()||document.hidden)return;
  pauseLightMusic();
  window.NOORAudio.say(noorPronunciation(message),{
    start:()=>halo?.classList.add('talking'),
    end:()=>{halo?.classList.remove('talking');onFinish?.();setTimeout(startLightMusic,450)},
    error:e=>{console.warn('NOOR dashboard speech:',e);halo?.classList.remove('talking');onFinish?.();setTimeout(startLightMusic,450)}
  });
}

/* ========================================
   DONOR SPOTLIGHT POP-UP
======================================== */

let currentDonor = "";
let spotlightTimer = null;

function showDonorSpotlight(name, message) {
  const box =
    document.getElementById("donorSpotlight");

  document.getElementById(
    "spotlightName"
  ).textContent =
    "Welcome, " + name + "!";

  // NEW: Display exactly the same thank-you
  // message that NOOR announces.
  document.getElementById(
    "spotlightMessage"
  ).textContent = message;

  box.classList.add("show");

  clearTimeout(spotlightTimer);

  spotlightTimer = setTimeout(
    () => box.classList.remove("show"),
    50000
  );
}

/* ========================================
   ANNOUNCE NEXT DONOR
======================================== */

function announceNext() {
  if (
    !audioUnlocked ||
    guestWelcomeActive() ||
    document.hidden ||
    speaking ||
    !announcementQueue.length
  ) return;

  const donor = announcementQueue.shift();
  currentAnnouncement = donor;

  speaking = true;
  currentDonor = donor.name;

  // Select one of the five thank-you messages.
  const message =
    getNextThankYouMessage(donor.name);

  // Show donor name and the exact message
  // that NOOR will speak.
  showDonorSpotlight(donor.name, message);

  alertBox.textContent =
    "♥ Thank you, " + donor.name + "!";

  lineBox.textContent = message;

  refresh();

  sayDashboard(message, () => {
    if (currentAnnouncement !== donor) return;
    currentAnnouncement = null;
    speaking = false;
    setTimeout(announceNext, 350);
  });
}

/* ========================================
   GOOGLE SHEET DONOR EVENTS
======================================== */

function getEvents(after) {
  return new Promise((resolve, reject) => {
    const cb =
      "noorEvent_" + Date.now() + "_" +
      Math.floor(Math.random() * 1e6);

    const script =
      document.createElement("script");

    let done = false;

    const timer = setTimeout(
      () => finish(
        new Error(
          "Announcement connection timed out"
        )
      ),
      12000
    );

    function finish(error, result) {
      if (done) return;

      done = true;
      clearTimeout(timer);
      delete window[cb];
      script.remove();

      error ? reject(error) : resolve(result);
    }

    window[cb] = result =>
      finish(
        result && result.error
          ? new Error(result.error)
          : null,
        result
      );

    script.onerror = () =>
      finish(
        new Error(
          "Announcement service unreachable"
        )
      );

    script.src =
      API_URL +
      "?action=events&after=" +
      encodeURIComponent(after) +
      "&callback=" + cb +
      "&_=" + Date.now();

    document.head.appendChild(script);
  });
}

async function pollEvents() {
  if (polling) return;

  polling = true;

  try {
    const result =
      await getEvents(lastEventId);

    if (
      !result.ok ||
      !Array.isArray(result.events)
    ) {
      throw Error(
        "Please deploy the latest Code.gs (events API)."
      );
    }

    if (!initialized) {
      initialized = true;

      if (lastEventId === 0) {
        const recent = result.events.filter(
          donor =>
            Date.now() -
            Number(donor.time) < 120000
        );

        if (recent.length) {
          announcementQueue.push(...recent);
        }

        lastEventId = Math.max(
          lastEventId,
          Number(result.latest) || 0
        );

      } else {
        for (const donor of result.events) {
          if (Number(donor.id) > lastEventId) {
            announcementQueue.push(donor);
          }
        }

        lastEventId = Math.max(
          lastEventId,
          Number(result.latest) || 0
        );
      }

    } else {
      for (const donor of result.events) {
        if (Number(donor.id) > lastEventId) {
          announcementQueue.push(donor);
          lastEventId = Number(donor.id);
        }
      }

      lastEventId = Math.max(
        lastEventId,
        Number(result.latest) || 0
      );
    }

    sessionStorage.setItem(
      "noorDashboardLastId",
      String(lastEventId)
    );

    if (announcementQueue.length) {
      announceNext();
    }

  } catch (error) {
    console.warn(error);

    alertBox.textContent =
      "⚠ Dashboard announcement connection: " +
      error.message;

  } finally {
    polling = false;
  }
}

/* ========================================
   AUTO REFRESH DONOR EVENTS
======================================== */

const speakBtn =
  document.getElementById("speak");

if (speakBtn) {
  speakBtn.onclick = () => {
    if (guestWelcomeActive()) return;
    voiceReady = true;

    if (announcementQueue.length) {
      announceNext();
    } else {
      sayDashboard(
        lineBox.textContent || DEFAULT_LINE
      );
    }
  };
}

if ("speechSynthesis" in window) {
  speechSynthesis.getVoices();

  speechSynthesis.addEventListener?.(
    "voiceschanged",
    () => {}
  );
}

pollEvents();
setInterval(pollEvents, 2000);

/* ========================================
   START LIVE DASHBOARD AUDIO (mobile-safe)
======================================== */
const startBtn=document.getElementById('startDashboard');
if(startBtn){
  startBtn.addEventListener('click',()=>{
    audioUnlocked=true;
    voiceReady=true;
    const overlay=document.getElementById('audioStart');
    const status=document.getElementById('noorAudioStatus');
    // Never await WebAudio before requesting TTS: iOS/Android require a direct tap.
    if(!guestWelcomeActive()){
      window.NOORAudio.say('Sat Shri Akal! NOOR is ready. Welcome to the Gian Jyoti Blood Donation Camp.',{
        start:()=>{halo?.classList.add('talking');if(status)status.textContent='NOOR speaking'},
        end:()=>{halo?.classList.remove('talking');if(status)status.textContent='Voice ready'},
        error:e=>{halo?.classList.remove('talking');if(status)status.textContent='Voice unavailable: '+e+' — try Test Voice'}
      });
    }
    // Unlock sound immediately in the same tap; do not make voice depend on music.
    window.NOORAudio.musicUnlock().then(result=>{
      if(result.context){musicCtx=result.context;startLightMusic();}
      if(status&&result.state!=='running')status.textContent='Music: '+result.state;
    });
    overlay?.classList.add('hide');
    setTimeout(()=>overlay?.remove(),450);
    setTimeout(()=>{if(!speaking&&announcementQueue.length)announceNext()},6500);
    pollEvents();
  });
}
// A separate tap is useful when a mobile speech engine failed to initialize.
const testBtn=document.getElementById('noorTestVoice');
testBtn?.addEventListener('click',()=>{
  const status=document.getElementById('noorAudioStatus');
  window.NOORAudio.say('Sat Shri Akal. NOOR voice test.',{
    start:()=>{if(status)status.textContent='NOOR speaking'},
    end:()=>{if(status)status.textContent='Voice test complete'},
    error:e=>{if(status)status.textContent='Speech error: '+e}
  });
  window.NOORAudio.musicUnlock().then(r=>{if(r.context){musicCtx=r.context;startLightMusic()}});
});
