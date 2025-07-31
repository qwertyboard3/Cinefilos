// 🌟 Element Selectors & Constants
const flow = document.getElementById("posterFlow");
const pickBtn = document.getElementById("randomPick");
const clearBtn = document.getElementById("clearHistory");
const historyList = document.getElementById("history");
const soundPick = document.getElementById("soundPick");
const posters = [];
let currentIdx = 0;
// 🔑 Multiple OMDb API Keys
const apiKeys = [
  "f05a8ae7", // key 1
  "225d3569"  // key 2
];

let apiKeyIndex = 0;
function getApiKey() {
  const key = apiKeys[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length; // rotate keys
  return key;
}
const FALLBACK_IMG = "posters/fallback.jpg";

// 🧩 Local Fallbacks & Overrides
const localFallback = {
      tt0134817: "posters/mecanica.jpg",
      tt0110413: "posters/leon.png",
      tt0034820: "posters/gaucha.jpg",
      tt0045230: "posters/thief.jpg",
      tt0064356: "posters/cow.jpg",
      tt0123885: "posters/trinquete.jpg",
      tt0070235: "posters/horse.jpg",
      tt0075726: "posters/barbara.jpg",
      tt0089078: "posters/elegido.jpg",
      tt0113855: "posters/pearl.jpg",
      tt0896690: "posters/miedo.jpg",
      tt1910653: "posters/triste.jpg",
      tt17068914: "posters/borges.jpg",
      tt1951524: "posters/sanguivorous.jpg",
      tt6833964: "posters/sonora.jpg",
      tt13686040: "posters/quarantine.jpg",
      tt23769666: "posters/1984.jpg",
      tt19880934: "posters/failure.jpg",
      tt26675379: "posters/vitoria.jpg",
};
const forcedTitles = {
  "tt0134817": "Mecánica Nacional",
  "tt26675379": "Vitória"
};
const forcedRuntime = {
  "tt0134817": "95 min",
  "tt26675379": "112 min"
};

// ✅ Image Validation
async function validateImage(url) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(url);
    img.onerror = () => res(FALLBACK_IMG);
    img.src = url;
  });
}

// 🎞 Fetch Poster Metadata
const fetchPoster = async (id) => {
  let posterUrl = FALLBACK_IMG, title = "", runtime = "";

  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&i=${id}`);
    const data = await res.json();
    if (data.Response === "True") {
      title = forcedTitles[id] || data.Title;
      runtime = forcedRuntime[id] || data.Runtime || "";
      posterUrl = await validateImage(localFallback[id] || data.Poster || FALLBACK_IMG);
    } else {
      title = forcedTitles[id] || id;
      runtime = forcedRuntime[id] || "";
      posterUrl = await validateImage(localFallback[id] || FALLBACK_IMG);
    }
  } catch {
    title = forcedTitles[id] || id;
    runtime = forcedRuntime[id] || "";
    posterUrl = await validateImage(localFallback[id] || FALLBACK_IMG);
  }

  return { id, title, posterUrl, runtime };
};

// 🔄 Update Coverflow Display
function updateCoverflow(addHistory = false) {
  const spacing = 150, maxTilt = 45, maxZ = 150, minScale = 0.7, scaleStep = 0.15;

  posters.forEach((p, i) => {
    const offset = i - currentIdx;
    const x = offset * spacing;
    const rot = -offset * maxTilt;
    const z = offset === 0 ? maxZ : maxZ * (1 - Math.min(Math.abs(offset), 3) / 3);
    const scale = Math.max(minScale, 1 - Math.abs(offset) * scaleStep);
    const zidx = offset === 0 ? 3000 : 1000 - Math.abs(offset);

    p.element.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateZ(${z}px)
      rotateY(${rot}deg)
      scale(${scale})
    `;
    p.element.style.zIndex = zidx;
    p.element.classList.toggle("selected", i === currentIdx);

    if (addHistory && i === currentIdx) {
      const exists = [...historyList.children].some(li => li.textContent.includes(p.title));
      if (!exists) {
        const li = document.createElement("li");
        li.innerHTML = `
          <div style="font-weight:bold;">${p.title}</div>
          <div style="font-size: 14px; opacity: 0.8;">${p.runtime}</div>
          <img src="${p.posterUrl}" alt="${p.title}">
        `;
        historyList.prepend(li);
      }
    }
  });
}


// 🚀 Initialize Posters with Shuffle
async function init() {
  // Shuffle Mode
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const movies = await Promise.all(entries.map(e => fetchPoster(e.imdbID)));
  movies.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "poster";
    div.innerHTML = `
      <div class="box">
        <div class="front">
          <img src="${m.posterUrl}" alt="${m.title}">
        </div>
        <div class="back">
          <div class="details">
            <h3>${m.title}</h3>
            <p>${m.runtime || "Duration not available."}</p>
          </div>
        </div>
      </div>
    `;
    flow.appendChild(div);
    posters.push({ ...m, element: div });

    div.addEventListener("click", () => {
      posters.forEach(p => p.element.classList.remove("flipped"));
      currentIdx = i;
      div.classList.toggle("flipped");
      updateCoverflow(false);
    });
  });

  currentIdx = Math.floor(posters.length / 2);
  setTimeout(() => {
    document.querySelector('.coverflow-container')?.classList.add('loaded');
    updateCoverflow(false);
  }, 100);

  // Loop Mode (Keyboard)
  window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") {
      posters.forEach(p => p.element.classList.remove("flipped"));
      currentIdx = (currentIdx - 1 + posters.length) % posters.length;
      updateCoverflow(false);
    }
    if (e.key === "ArrowRight") {
      posters.forEach(p => p.element.classList.remove("flipped"));
      currentIdx = (currentIdx + 1) % posters.length;
      updateCoverflow(false);
    }
  });

  // Loop Mode (Touch Swipes)
  let startX = 0, isDragging = false;
  flow.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
    }
  });
  flow.addEventListener("touchmove", e => {
    if (isDragging) {
      const deltaX = e.touches[0].clientX - startX;
      posters.forEach(p => p.element.classList.remove("flipped"));
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) currentIdx = (currentIdx - 1 + posters.length) % posters.length;
        else currentIdx = (currentIdx + 1) % posters.length;
        updateCoverflow(false);
        isDragging = false;
      }
    }
  });
  flow.addEventListener("touchend", () => isDragging = false);

  // 🔀 Random Pick Button
  const pickedIds = new Set();
  pickBtn.addEventListener("click", () => {
    if (pickedIds.size === posters.length) {
      alert("All movies have been picked!");
      return;
    }

    let idx;
    do {
      idx = Math.floor(Math.random() * posters.length);
    } while (pickedIds.has(posters[idx].id));

    pickedIds.add(posters[idx].id);
    posters.forEach(p => p.element.classList.remove("flipped"));
    currentIdx = idx;

    posters[currentIdx].element.classList.add("flipped");
    soundPick.play();
    updateCoverflow(true);
  });
}



init();

// 🛎 Service Worker + Button Visuals
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.error('SW error:', err));
  });
}

document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 100);
  });
});

clearBtn.addEventListener("click", () => {
  historyList.innerHTML = "";
  location.reload();
});


