// 🌟 Element Selectors & Constants
const flow = document.getElementById("posterFlow");
const pickBtn = document.getElementById("randomPick");
const clearBtn = document.getElementById("clearHistory");
const historyList = document.getElementById("history");
const soundPick = document.getElementById("soundPick");
const posters = [];
let currentIdx = 0;

// 🔑 Single OMDb API Key
const apiKey = "//225d3569";

let apiKeyIndex = 0;

async function getValidApiKey(id) {
  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[apiKeyIndex];
    apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length;
    
    const res = await fetch(`https://www.omdbapi.com/?apikey=${key}&i=${id}`);
    const data = await res.json();
    
    if (data.Response === "True") return { data, key };
    if (data.Error && data.Error.includes("limit")) {
      console.warn(`Key ${key} limit reached, switching...`);
      continue;
    }
    if (data.Error && data.Error.includes("Invalid API key")) {
      console.warn(`Key ${key} invalid, switching...`);
      continue;
    }
  }
  throw new Error("All API keys exhausted or invalid.");
}
const FALLBACK_IMG = "posters/fallback.jpg";



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
// Cache duration (in ms) — e.g. 7 days
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

const fetchPoster = async (id) => {
  let posterUrl = FALLBACK_IMG, title = "", runtime = "";

  // 🔍 1. Check cache first
  const cacheKey = `poster_${id}`;
  const cachedData = JSON.parse(localStorage.getItem(cacheKey));

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    console.log(`Using cached data for ${id}`);
    return cachedData.data;
  }

  // 🌐 2. Otherwise fetch from API
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&i=${id}`);
    const data = await res.json();
    console.log("OMDb data for", id, ":", data);

    if (data.Response === "True") {
      title = movieTitles[id] || data.Title;
      runtime = forcedRuntime[id] || data.Runtime || "";
      posterUrl = await validateImage(localFallback[id] || data.Poster || FALLBACK_IMG);
    } else {
      title = movieTitles[id] || id;
      runtime = forcedRuntime[id] || "";
      posterUrl = await validateImage(localFallback[id] || FALLBACK_IMG);
    }
  } catch (err) {
    console.error("Error fetching poster:", err);
    title = movieTitles[id] || id;
    runtime = forcedRuntime[id] || "";
    posterUrl = await validateImage(localFallback[id] || FALLBACK_IMG);
  }

  const result = { id, title, posterUrl, runtime };

  // 💾 3. Store in localStorage
  localStorage.setItem(cacheKey, JSON.stringify({
    timestamp: Date.now(),
    data: result
  }));

  return result;
};
// 🔄 Update Coverflow Display
function updateCoverflow(addHistory = false) {
  const spacing = 165, maxTilt = 45, maxZ = 150, minScale = 0.7, scaleStep = 0.15;

  posters.forEach((p, i) => {
    const offset = i - currentIdx;
    const x = offset * spacing;
    const rot = -Math.sign(offset) * maxTilt;
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
          <div style="font-weight:bold;"></div>
          <div style="font-size: 14px; opacity: 0.8;"></div>
          <img>
        `;
        const [title, runtime, image] = li.children;
        title.textContent = p.title;
        runtime.textContent = p.runtime;
        image.src = p.posterUrl;
        image.alt = p.title;
        historyList.prepend(li);
      }
    }
  });
}


// 🚀 Initialize Posters with Shuffle
async function init() {
  const snapshot = typeof traktMovies === "undefined" ? [] : traktMovies;
  const activeIds = Array.isArray(snapshot) ? null : new Set(snapshot.activeIds);
  const imported = Array.isArray(snapshot) ? snapshot : snapshot.movies;
  const catalog = new Map(
    entries
      .filter(entry => !activeIds || activeIds.has(entry.imdbID))
      .map(entry => [entry.imdbID, { id: entry.imdbID }])
  );
  for (const movie of imported) {
    if (!catalog.has(movie.id)) catalog.set(movie.id, movie);
  }
  const movies = await Promise.all(
    [...catalog.values()].map(movie => movie.posterUrl ? movie : fetchPoster(movie.id))
  );
  if (movies.length === 0) {
    flow.textContent = "No movies on the Trakt list.";
    pickBtn.disabled = true;
    return;
  }

  // Shuffle Mode
  for (let i = movies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [movies[i], movies[j]] = [movies[j], movies[i]];
  }

  movies.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "poster";
    div.innerHTML = `
      <div class="box">
        <div class="front">
          <img>
        </div>
        <div class="spine spine-left"></div>
        <div class="spine spine-right"></div>
        <div class="case-top"></div>
        <div class="back">
          <div class="details">
            <h3></h3>
            <p></p>
          </div>
        </div>
      </div>
    `;
    const image = div.querySelector(".front img");
    image.src = m.posterUrl;
    image.alt = m.title;
    div.querySelector(".details h3").textContent = m.title;
    div.querySelector(".details p").textContent = m.runtime || "Duration not available.";

    const caption = document.createElement("span");
    caption.className = "movie-caption";
    const year = m.year || movieYears[m.id];
    caption.textContent = year ? `${m.title} (${year})` : m.title;
    div.appendChild(caption);
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


