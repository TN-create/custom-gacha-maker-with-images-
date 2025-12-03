(() => {
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.substring(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    for (const child of children.flat()) {
      if (child == null) continue;
      node.append(child.nodeType ? child : document.createTextNode(child));
    }
    return node;
  };

  const state = {
    nextId: 1,
    groups: [] // {id, name, rarity(Number), images: [{id, name, url}]}
    ,modal: {
      items: [],
      index: 0,
      open: false,
      dir: "next", // track last navigation direction
    },
    inventory: new Map(),
  };

  // Expose inventory for game module
  window.GachaApp = {
    getInventory: () => Array.from(state.inventory.values()),
    getGroups: () => state.groups.map(g => ({ name: g.name, rarity: g.rarity })),
    // Expose method to calculate stats based on rarity
    calculateStats: (rarity) => {
      // Get all groups with rarity > 0 to determine relative rarity
      const pool = state.groups.filter(g => g.images.length > 0 && g.rarity > 0);
      const totalRarity = pool.reduce((a, g) => a + g.rarity, 0);
      
      if (pool.length <= 1 || totalRarity <= 0) {
        // Only one group or no valid groups - minimum stats
        return { hp: 50, attack: 10 };
      }
      
      // Calculate rarity ratio (0 = most common, 1 = rarest)
      // Lower rarity number = rarer = higher stats
      const rarityRatio = 1 - (rarity / totalRarity);
      
      // Scale stats: rarer items get better stats
      // HP: 50 (common) to 150 (rare)
      // Attack: 10 (common) to 40 (rare)
      const hp = Math.floor(50 + rarityRatio * 100);
      const attack = Math.floor(10 + rarityRatio * 30);
      
      return { hp, attack };
    },
  };

  const refs = {
    createForm: document.getElementById("createGroupForm"),
    nameInput: document.getElementById("groupName"),
    rarityInput: document.getElementById("groupRarity"),
    groupsList: document.getElementById("groupsList"),
    rollOneBtn: document.getElementById("rollOneBtn"),
    rollTenBtn: document.getElementById("rollTenBtn"),
    results: document.getElementById("results"),
    // Overlay refs (fix first-roll popup bug)
    overlay: document.getElementById("overlay"),
    particles: document.getElementById("particles"),
    skipBtn: document.getElementById("skipBtn"),
    // Modal refs...
    modal: document.getElementById("resultModal"),
    modalImage: document.getElementById("modalImage"),
    modalTitle: document.getElementById("modalTitle"),
    modalGroup: document.getElementById("modalGroup"),
    modalIndex: document.getElementById("modalIndex"),
    modalThumbs: document.getElementById("modalThumbs"),
    modalClose: document.getElementById("modalClose"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    burst: document.getElementById("burst"),
    inventoryResults: document.getElementById("inventoryResults"),
    // Removed: cutscene refs
    postRollCutscene: document.getElementById("postRollCutscene"),
    prSkip: document.getElementById("prSkip"),
    prSummary: document.getElementById("prSummary"),
    // Cinematic refs
    rollCinematic: document.getElementById("rollCinematic"),
    rcParticles: document.getElementById("rcParticles"),
    rcCards: document.getElementById("rcCards"),
    rcSkip: document.getElementById("rcSkip"),
    // Export/Import refs
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importInput: document.getElementById("importInput"),
  };

  // Helpers
  const clampName = (val, fallback) => (val && val.trim().length ? val.trim() : fallback);
  const parseRarity = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const fileTitle = (filename = "") => {
    const base = filename.replace(/[#?].*$/, "");
    const last = base.lastIndexOf(".");
    const raw = last > 0 ? base.slice(0, last) : base;
    return raw.replace(/[_\-]+/g, " ").trim() || raw || "Untitled";
  };

  const revokeImages = (images) => images.forEach(img => { try { URL.revokeObjectURL(img.url); } catch {} });

  // Rendering
  const render = () => {
    refs.groupsList.innerHTML = "";
    state.groups.forEach(g => refs.groupsList.append(renderGroup(g)));
  };

  const renderGroup = (group) => {
    const nameInput = el("input", {
      class: "name-input",
      type: "text",
      value: group.name,
      placeholder: "Group name",
      required: "true",
      onblur: () => {
        const newName = clampName(nameInput.value, group.name);
        nameInput.value = newName;
        group.name = newName;
      }
    });
    const rarityInput = el("input", {
      class: "rarity-input",
      type: "number",
      min: "0", step: "0.01",
      value: String(group.rarity),
      onblur: () => {
        const newR = parseRarity(rarityInput.value, group.rarity);
        rarityInput.value = String(newR);
        group.rarity = newR;
      }
    });

    const uploadInput = el("input", {
      type: "file",
      accept: "image/*",
      multiple: "true",
      style: "display:none",
      onchange: (e) => handleFilesSelected(group.id, e.target.files),
    });

    const addBtn = el("button", {
      class: "btn small",
      type: "button",
      onclick: () => uploadInput.click()
    }, "Add images");

    const copyBtn = el("button", {
      class: "btn small",
      type: "button",
      onclick: () => duplicateGroup(group)
    }, "Copy");

    const deleteBtn = el("button", {
      class: "btn small danger",
      type: "button",
      onclick: (e) => {
        // Get the group id from the nearest card to avoid stale closures
        const card = e.currentTarget.closest(".group");
        const idStr = card?.dataset?.id;
        const id = Number(idStr);
        const idx = state.groups.findIndex(g => g.id === id);
        if (idx === -1) return;

        const g = state.groups[idx];
        if (!confirm(`Delete group "${g.name}" and its ${g.images.length} image(s)?`)) return;

        // Remove related inventory entries first
        g.images.forEach(img => removeInventoryByImageId(img.id));
        // Revoke blob URLs, remove from state, and re-render
        revokeImages(g.images);
        state.groups.splice(idx, 1);
        render();
      }
    }, "Delete");

    const dragUI = el("div", { class: "drag-hint" },
      el("span", { class: "drag-handle", title: "Drag to reorder" }),
      el("span", {}, "Drag to reorder")
    );

    const header = el("div", { class: "group-header" },
      nameInput,
      el("div", { class: "rarity-wrap" }, rarityInput, el("span", {}, "%")),
      el("div", { class: "group-actions" }, dragUI, addBtn, copyBtn, deleteBtn)
    );

    const thumbs = el("div", { class: "thumb-grid" }, group.images.map(img => renderThumb(group, img)));

    const groupCard = el("div", {
      class: "group",
      dataset: { id: group.id },
      tabindex: "0",
      onkeydown: (e) => {
        if (!e.altKey) return;
        const idx = state.groups.findIndex(g => g.id === group.id);
        if (idx === -1) return;
        if (e.key === "ArrowUp" && idx > 0) {
          moveGroupToIndex(group.id, idx - 1);
          e.preventDefault();
        } else if (e.key === "ArrowDown" && idx < state.groups.length - 1) {
          moveGroupToIndex(group.id, idx + 1);
          e.preventDefault();
        }
      }
    },
      header,
      el("div", { class: "row between" },
        el("small", { class: "muted" }, `${group.images.length} image(s)`),
        uploadInput
      ),
      thumbs
    );

    // Enable both native DnD and pointer sorting
    enableNativeDnD(groupCard);
    enablePointerSort(groupCard);

    return groupCard;
  };

  // Render a group thumbnail with click-to-rename
  const renderThumb = (group, img) => {
    const remove = () => {
      group.images = group.images.filter(i => i.id !== img.id);
      // Also remove from inventory
      removeInventoryByImageId(img.id);
      try { URL.revokeObjectURL(img.url); } catch {}
      render();
    };
    // Click on image to edit title; avoid clicks on remove button
    const onThumbClick = (e) => {
      if (e.target.closest(".remove")) return;
      const current = img.title || fileTitle(img.name);
      const next = prompt("Edit image display title:", current);
      if (next == null) return; // cancelled
      const newTitle = next.trim();
      if (!newTitle.length) return; // ignore empty
      img.title = newTitle;
      // Reflect rename in inventory if present
      updateInventoryTitle(img.id, newTitle);
      render();
    };
    return el("div", { class: "thumb", title: img.title || img.name, onclick: onThumbClick },
      el("img", { src: img.url, alt: img.title || img.name }),
      el("div", { class: "caption" }, img.title || img.name),
      el("button", { class: "remove", type: "button", onclick: remove }, "×")
    );
  };

  // File handling
  const handleFilesSelected = (groupId, fileList, thumbsContainer) => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    const files = Array.from(fileList || []);
    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      group.images.push({
        id: crypto.randomUUID(),
        name: file.name,
        title: fileTitle(file.name),
        url
      });
    });
    render();
  };

  // Weighted random selection of groups with images
  const pickGroupByRarity = () => {
    const pool = state.groups.filter(g => g.images.length > 0 && g.rarity > 0);
    const total = pool.reduce((a, g) => a + g.rarity, 0);
    if (pool.length === 0 || total <= 0) return null;
    let r = Math.random() * total;
    for (const g of pool) {
      if ((r -= g.rarity) <= 0) return g;
    }
    return pool[pool.length - 1] || null;
  };

  // Animation overlay
  let animationActive = false;
  const clearParticles = () => { refs.particles.innerHTML = ""; };
  const spawnParticles = (count = 28) => {
    clearParticles();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "particle " + (Math.random() < 0.5 ? "star" : "diamond");
      const left = (Math.random() * 100).toFixed(2) + "%";
      const delay = (Math.random() * 1.2).toFixed(2) + "s";
      const dur = (2 + Math.random() * 2).toFixed(2) + "s";
      const scale = (0.6 + Math.random() * 0.9).toFixed(2);
      p.style.left = left;
      p.style.bottom = (-10 - Math.random() * 20) + "px";
      p.style.setProperty("--delay", delay);
      p.style.setProperty("--dur", dur);
      p.style.setProperty("--scale", scale);
      refs.particles.appendChild(p);
    }
  };
  const playRollAnimation = (ms = 1400) => {
    if (animationActive) return Promise.resolve(); // avoid stacking
    animationActive = true;
    refs.overlay.classList.remove("hidden");
    refs.overlay.setAttribute("aria-hidden", "false");
    spawnParticles();

    let done;
    const p = new Promise((resolve) => { done = resolve; });
    const timer = setTimeout(done, ms);
    const onSkip = () => done();

    const finish = () => {
      clearTimeout(timer);
      refs.skipBtn.removeEventListener("click", onSkip);
      refs.overlay.classList.add("hidden");
      refs.overlay.setAttribute("aria-hidden", "true");
      clearParticles();
      animationActive = false;
    };

    refs.skipBtn.addEventListener("click", onSkip, { once: true });
    return p.then(finish);
  };

  // Cinematic roll animation
  const playRollCinematic = (items) => {
    if (!refs.rollCinematic) return Promise.resolve();
    return new Promise(resolve => {
      let skipped = false;
      refs.rollCinematic.classList.remove("hidden");
      refs.rollCinematic.setAttribute("aria-hidden","false");
      refs.rcParticles.innerHTML = "";
      refs.rcCards.innerHTML = "";

      const cleanup = () => {
        refs.rcSkip.removeEventListener("click", onSkip);
        refs.rollCinematic.classList.add("hidden");
        refs.rollCinematic.setAttribute("aria-hidden","true");
        refs.rcParticles.innerHTML = "";
        refs.rcCards.innerHTML = "";
        resolve();
      };
      const onSkip = () => { skipped = true; cleanup(); };
      refs.rcSkip.addEventListener("click", onSkip, { once:true });

      // Spawn swirling icon particles
      const spawnParticles = (count = 36) => {
        for (let i=0;i<count;i++){
          const p = document.createElement("i");
          p.className="rc-particle";
          p.style.backgroundImage = Math.random()<0.55 ? "var(--icon-star)" : "var(--icon-diamond)";
          const ang = Math.random()*Math.PI*2;
          const dist = 150 + Math.random()*260;
          p.style.setProperty("--dx", Math.cos(ang)*dist + "px");
          p.style.setProperty("--dy", Math.sin(ang)*dist + "px");
          p.style.animationDelay = (Math.random()*0.8).toFixed(2)+"s";
          p.style.animationDuration = (2.6+Math.random()*1.4).toFixed(2)+"s";
          p.style.left = "50%";              // center emission
          p.style.top = "50%";
          refs.rcParticles.appendChild(p);
          p.addEventListener("animationend", ()=> p.remove());
        }
      };
      spawnParticles();

      let idx = 0;
      const interval = 520;

      const nextCard = () => {
        if (skipped) return;
        if (idx >= items.length) {
          setTimeout(()=> { if (!skipped) cleanup(); }, 700);
          return;
        }
        const { group, img } = items[idx];
        const card = document.createElement("div");
        card.className = "rc-card";
        card.style.zIndex = 5 + idx;
        card.innerHTML = `
          <img src="${img.url}" alt="${(img.title||img.name).replace(/"/g,"&quot;")}">
          <div class="rc-title">${group.name} • ${(img.title||img.name)}</div>
        `;
        refs.rcCards.appendChild(card);

        // Schedule flip and settle
        setTimeout(()=> {
          if (skipped) return;
          card.classList.add("reveal");
          // Minor particle burst per card
          spawnParticles(8);
          setTimeout(()=> {
            if (skipped) return;
            card.classList.add("final");
          },600);
        },300);

        idx++;
        setTimeout(nextCard, interval);
      };
      nextCard();
    });
  };

  // Modal: neon star burst emitting from image edges
  const burstStars = (count = 16) => {
    refs.burst.innerHTML = "";
    const imgEl = refs.modalImage;
    const canvasEl = refs.modalImage.closest(".canvas");
    if (!imgEl || !canvasEl) return;

    // Get bounding boxes relative to canvas to compute edges
    const canvasRect = canvasEl.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();

    // Calculate relative positions inside canvas
    const left = imgRect.left - canvasRect.left;
    const right = imgRect.right - canvasRect.left;
    const top = imgRect.top - canvasRect.top;
    const bottom = imgRect.bottom - canvasRect.top;

    // Edge samplers: top, bottom, left, right
    const edges = [
      { edge: "top", x0: left, x1: right, y: top, nx: 0, ny: -1 },
      { edge: "bottom", x0: left, x1: right, y: bottom, nx: 0, ny: 1 },
      { edge: "left", y0: top, y1: bottom, x: left, nx: -1, ny: 0 },
      { edge: "right", y0: top, y1: bottom, x: right, nx: 1, ny: 0 },
    ];

    const particles = Math.max(8, count);
    for (let i = 0; i < particles; i++) {
      const e = edges[i % edges.length];
      let px, py;

      if (e.edge === "top" || e.edge === "bottom") {
        const t = Math.random();
        px = e.x0 + t * (e.x1 - e.x0);
        py = e.y;
      } else {
        const t = Math.random();
        px = e.x;
        py = e.y0 + t * (e.y1 - e.y0);
      }

      // Randomize direction slightly outward from the edge normal
      const spread = (Math.random() - 0.5) * 0.8; // small angle variation
      const dirX = e.nx + (e.ny ? spread : 0);
      const dirY = e.ny + (e.nx ? spread : 0);

      const dist = 80 + Math.random() * 140; // travel distance in px
      const dx = dirX * dist;
      const dy = dirY * dist;

      const p = document.createElement("i");
      p.className = "particle star";
      // Position the particle origin inside the canvas coordinate system
      // burst container is positioned absolutely within canvas; use CSS vars with pixel offsets
      const centerX = px;
      const centerY = py;
      // Translate CSS vars relative to center of burst container
      // We anchor burst at center via CSS translate(-50%,-50%), so convert to dx/dy from center
      const canvasCenterX = canvasRect.width / 2;
      const canvasCenterY = canvasRect.height / 2;
      p.style.setProperty("--dx", (centerX - canvasCenterX + dx) + "px");
      p.style.setProperty("--dy", (centerY - canvasCenterY + dy) + "px");
      p.style.setProperty("--rot", (Math.random() * 360).toFixed(0) + "deg");
      refs.burst.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  };

  // Modal viewer
  const openModal = (items, startIndex = 0, { preview = false } = {}) => {
    state.modal.items = items.slice();
    state.modal.index = Math.min(Math.max(0, startIndex), items.length - 1);
    state.modal.open = true;
    state.modal.dir = "next";
    refs.modal.classList.toggle("preview", preview);
    refs.modal.classList.remove("hidden");
    refs.modal.setAttribute("aria-hidden", "false");
    updateModal(preview);
    // Keyboard nav
    document.addEventListener("keydown", onKeyNav);
  };

  const closeModal = () => {
    if (!state.modal.open) return;
    state.modal.open = false;
    refs.modal.classList.add("hidden");
    refs.modal.setAttribute("aria-hidden", "true");
    refs.burst.innerHTML = "";
    refs.modal.classList.remove("preview");
    document.removeEventListener("keydown", onKeyNav);
  };

  const onKeyNav = (e) => {
    if (!state.modal.open) return;
    if (e.key === "Escape") { closeModal(); }
    else if (e.key === "ArrowRight") { nextModal(); }
    else if (e.key === "ArrowLeft") { prevModal(); }
  };

  const updateModal = (preview = refs.modal.classList.contains("preview")) => {
    const items = state.modal.items;
    const i = state.modal.index;
    if (!items.length) return;
    const { group, img } = items[i];
    const wasSrc = refs.modalImage.src;
    const willChange = !!wasSrc && wasSrc !== img.url;
    if (willChange) {
      refs.modalImage.classList.remove("slide-next","slide-prev","fade-in");
      refs.modalImage.classList.add("fade-out");
    }
    const applyNewImage = () => {
      refs.modalImage.src = img.url;
      refs.modalImage.alt = img.title || img.name;
      refs.modalTitle.textContent = img.title || fileTitle(img.name);
      refs.modalGroup.textContent = group.name;
      refs.modalIndex.textContent = `${i + 1} / ${items.length}`;
      refs.modalImage.classList.remove("slide-next","slide-prev","fade-out","fade-in");
      const dirClass = state.modal.dir === "prev" ? "slide-prev" : "slide-next";
      void refs.modalImage.offsetWidth;
      refs.modalImage.classList.add("fade-in", dirClass);
      refs.modalImage.addEventListener("animationend", () => {
        refs.modalImage.classList.remove("fade-in", dirClass);
      }, { once: true });
      refs.modalThumbs.innerHTML = "";
      if (!preview) burstStars(20); // suppress effects for inventory preview
    };
    if (willChange) {
      refs.modalImage.addEventListener("animationend", applyNewImage, { once: true });
    } else {
      applyNewImage();
    }
  };

  const nextModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index + 1;
    if (n < state.modal.items.length) {
      state.modal.dir = "next";
      state.modal.index = n;
      updateModal();
    }
  };
  const prevModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index - 1;
    if (n >= 0) {
      state.modal.dir = "prev";
      state.modal.index = n;
      updateModal();
    }
  };

  refs.modalClose.addEventListener("click", closeModal);
  refs.nextBtn.addEventListener("click", nextModal);
  refs.prevBtn.addEventListener("click", prevModal);
  refs.modal.addEventListener("click", (e) => {
    if (e.target === refs.modal) closeModal();
  });

  // Clone an image's blob URL into a new independent blob URL
  const cloneImageUrl = async (srcUrl) => {
    try {
      const res = await fetch(srcUrl);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return srcUrl; // fallback to original if fetch fails
    }
  };

  // Inventory aggregation
  const addToInventory = async (items) => {
    for (const { group, img } of items) {
      const key = img.id;
      const existing = state.inventory.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        // Clone the URL so inventory persists even if the original group/image is deleted
        const clonedUrl = await cloneImageUrl(img.url);
        // Calculate permanent stats based on group rarity
        const stats = window.GachaApp.calculateStats(group.rarity);
        // Assign a random ability
        const ability = window.Abilities?.getRandomAbility() || null;
        state.inventory.set(key, {
          id: key,
          title: img.title || fileTitle(img.name),
          groupName: group.name,
          groupRarity: group.rarity,
          url: clonedUrl,
          count: 1,
          // Permanent stats based on rarity
          maxHp: stats.hp,
          attack: stats.attack,
          // Assigned ability
          ability: ability,
        });
      }
    }
  };

  // Inventory sync helpers
  const removeInventoryByImageId = (imgId) => {
    if (state.inventory.delete(imgId)) {
      renderInventory();
    }
  };
  const updateInventoryTitle = (imgId, newTitle) => {
    const it = state.inventory.get(imgId);
    if (it) {
      it.title = newTitle;
      renderInventory();
    }
  };

  const renderInventory = () => {
    if (!refs.inventoryResults) return;
    refs.inventoryResults.innerHTML = "";
    const list = Array.from(state.inventory.values());
    if (!list.length) {
      refs.inventoryResults.append(
        el("div", { class: "card" }, el("div", { class: "muted" }, "No items yet. Roll to fill your inventory."))
      );
      return;
    }
    let content;
    if (list.length === 1) {
      const it = list[0];
      content = el("div", { class: "result-card", onclick: () => openModal([{ group:{name: it.groupName}, img:{ url: it.url, name: it.title, title: it.title, id: it.id } }], 0, { preview: true }) },
        el("img", { src: it.url, alt: it.title }),
        el("div", { class: "count-badge" }, `${it.count}x`),
        el("div", { class: "meta" }, `${it.groupName} • ${it.title}`)
      );
    } else {
      content = el("div", { class: "grid" },
        list.map(it =>
          el("div", { class: "result-card", onclick: () => openModal([{ group:{name: it.groupName}, img:{ url: it.url, name: it.title, title: it.title, id: it.id } }], 0, { preview: true }) },
            el("img", { src: it.url, alt: it.title }),
            el("div", { class: "count-badge" }, `${it.count}x`),
            el("div", { class: "meta" }, `${it.groupName} • ${it.title}`)
          )
        )
      );
    }
    refs.inventoryResults.append(content);
  };

  const rollOnce = async () => {
    const group = pickGroupByRarity();
    if (!group) {
      showMessage("No eligible groups to roll. Add images and set rarity > 0.");
      return;
    }
    const img = group.images[Math.floor(Math.random() * group.images.length)];
    await playRollAnimation(1400);
    const items = [{ group, img }];
    showResults(items);
    await addToInventory(items);
    renderInventory();
    await playRollCinematic(items);
    openModal(items, 0);
  };

  const rollTen = async () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      const group = pickGroupByRarity();
      if (!group) break;
      const img = group.images[Math.floor(Math.random() * group.images.length)];
      results.push({ group, img });
    }
    if (!results.length) {
      showMessage("No eligible groups to roll. Add images and set rarity > 0.");
      return;
    }
    await playRollAnimation(1700);
    showResults(results);
    await addToInventory(results);
    renderInventory();
    await playRollCinematic(results);
    openModal(results, 0);
  };

  // Results rendering
  const showMessage = (text) => {
    refs.results.innerHTML = "";
    refs.results.append(
      el("div", { class: "card" }, el("div", { class: "muted" }, text))
    );
  };

  // Enhance results rendering: clicking a card opens modal at that index
  const showResults = (items) => {
    refs.results.innerHTML = "";
    if (items.length === 1) {
      const { group, img } = items[0];
      const card = el("div", { class: "result-card" },
        el("img", { src: img.url, alt: img.title || img.name }),
        el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
      );
      card.addEventListener("click", () => openModal(items, 0));
      refs.results.append(card);
    } else {
      const grid = el("div", { class: "grid" }, items.map(({ group, img }, idx) => {
        const card = el("div", { class: "result-card" },
          el("img", { src: img.url, alt: img.title || img.name }),
          el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
        );
        card.addEventListener("click", () => openModal(items, idx));
        return card;
      }));
      refs.results.append(grid);
    }
  };

  // Duplicate a group's data including images (with new URLs)
  const duplicateGroup = async (group) => {
    const newImages = [];
    for (const img of group.images) {
      const newUrl = await cloneImageUrl(img.url);
      newImages.push({
        id: crypto.randomUUID(),
        name: img.name,
        title: img.title,
        url: newUrl
      });
    }
    const copy = {
      id: state.nextId++,
      name: `${group.name} (Copy)`,
      rarity: group.rarity,
      images: newImages
    };
    state.groups.push(copy);
    render();
    queueMicrotask(() => { refs.groupsList.scrollTop = refs.groupsList.scrollHeight; });
  };

  // Reorder helpers
  const moveGroupToIndex = (id, newIdx) => {
    const curIdx = state.groups.findIndex(g => g.id === id);
    if (curIdx === -1 || newIdx === -1 || curIdx === newIdx) return;
    const [item] = state.groups.splice(curIdx, 1);
    state.groups.splice(newIdx, 0, item);
    render();
  };
  const indexFromCard = (card) => Number(card?.dataset?.id) ? state.groups.findIndex(g => g.id === Number(card.dataset.id)) : -1;

  // Pointer-driven sorting (mobile + desktop fallback)
  const enablePointerSort = (card) => {
    const handle = card.querySelector(".drag-handle");
    if (!handle) return;

    let draggingId = null;
    let placeholder = null;
    let startY = 0;

    const listEl = refs.groupsList;

    const onPointerMove = (e) => {
      if (!draggingId) return;
      const ptY = e.clientY;
      // Find closest group under pointer
      const cards = Array.from(listEl.children);
      let targetIdx = -1;
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        if (ptY >= r.top && ptY <= r.bottom) {
          // Decide before/after by midline
          targetIdx = ptY < (r.top + r.height / 2) ? i : i + 1;
          break;
        }
      }
      if (targetIdx === -1) {
        // Outside: auto-scroll if near edges
        const rect = listEl.getBoundingClientRect();
        if (ptY < rect.top + 40) listEl.scrollTop -= 20;
        else if (ptY > rect.bottom - 40) listEl.scrollTop += 20;
        return;
      }

      // Create/update placeholder
      if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "group placeholder";
        placeholder.style.height = card.getBoundingClientRect().height + "px";
        listEl.insertBefore(placeholder, listEl.children[targetIdx] || null);
      } else {
        const currentIndex = Array.from(listEl.children).indexOf(placeholder);
        if (currentIndex !== targetIdx) {
          listEl.insertBefore(placeholder, listEl.children[targetIdx] || null);
        }
      }
    };

    const endDrag = () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
      if (draggingId && placeholder) {
        const dropIdx = Array.from(listEl.children).indexOf(placeholder);
        placeholder.remove();
        placeholder = null;
        // Translate DOM index to state index (only count .group cards)
        const groupsDom = Array.from(listEl.children).filter(n => n.classList.contains("group"));
        const dropGroupCard = groupsDom[dropIdx] || null;
        const newStateIdx = dropGroupCard ? indexFromCard(dropGroupCard) : state.groups.length;
        moveGroupToIndex(draggingId, newStateIdx);
      }
      draggingId = null;
    };

    handle.addEventListener("pointerdown", (e) => {
      // Only left button / primary touch
      if (e.button !== undefined && e.button !== 0) return;
      draggingId = Number(card.dataset.id);
      startY = e.clientY;
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", endDrag);
      e.preventDefault();
    });
  };

  // Improve DnD consistency for mouse (HTML5)
  const enableNativeDnD = (card) => {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(card.dataset.id));
      try { e.dataTransfer.setDragImage(card, 10, 10); } catch {}
      card.classList.add("placeholder");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("placeholder");
      Array.from(refs.groupsList.children).forEach(c => c.classList.remove("drag-over"));
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    });
    card.addEventListener("dragleave", (e) => {
      e.currentTarget.classList.remove("drag-over");
    });
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      const dragId = Number(e.dataTransfer.getData("text/plain"));
      const dropIdx = indexFromCard(e.currentTarget);
      if (dropIdx !== -1) {
        moveGroupToIndex(dragId, dropIdx);
      }
    });
  };

  // Form events
  refs.createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = clampName(refs.nameInput.value, "");
    const rarity = parseRarity(refs.rarityInput.value, NaN);

    if (!name || !Number.isFinite(rarity)) {
      alert("Please provide both a group name and a valid rarity.");
      return;
    }

    const group = {
      id: state.nextId++,
      name,
      rarity,
      images: []
    };
    state.groups.push(group);
    refs.createForm.reset();
    render();

    // Scroll to bottom to reveal the newly added group
    queueMicrotask(() => { refs.groupsList.scrollTop = refs.groupsList.scrollHeight; });
  });

  refs.rollOneBtn.addEventListener("click", rollOnce);
  refs.rollTenBtn.addEventListener("click", rollTen);

  // Busy overlay helpers
  const busyEl = document.getElementById("busyOverlay");
  const busyTextEl = document.getElementById("busyText");
  const showBusy = (text = "Working...") => {
    if (!busyEl) return;
    busyTextEl && (busyTextEl.textContent = text);
    busyEl.classList.remove("hidden");
    busyEl.setAttribute("aria-hidden", "false");
  };
  const hideBusy = () => {
    if (!busyEl) return;
    busyEl.classList.add("hidden");
    busyEl.setAttribute("aria-hidden", "true");
  };

  // Export/Import refs
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");

  // Helpers for URL <-> dataURL
  const urlToDataUrl = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result); // data URL
        reader.readAsDataURL(blob);
      });
    } catch {
      return url; // fallback
    }
  };
  const dataUrlToBlobUrl = async (dataUrl) => {
    // Turn embedded data URL back into object URL (for img.src usage)
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      // Fallback: decode by atob
      const parts = dataUrl.split(",");
      const mime = (parts[0].match(/data:(.*?);/) || [])[1] || "application/octet-stream";
      const bstr = atob(parts[1] || "");
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    }
  };

  // Compact export (schema v2)
  const exportData = async () => {
    // ...existing code up to inventoryOut...
    const defaultName = `gacha-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}`;
    const result = prompt("Enter export file name (without extension):", defaultName);
    if (result === null) return;
    const name = (result.trim() || defaultName);

    showBusy("Exporting...");
    try {
      const imagesDict = {};
      const groupsOut = [];

      for (const g of state.groups) {
        const imgIds = [];
        for (const img of g.images) {
          imgIds.push(img.id);
          if (!imagesDict[img.id]) {
            imagesDict[img.id] = {
              d: await urlToDataUrl(img.url),
              n: img.name,
              t: img.title || fileTitle(img.name),
            };
          }
        }
        groupsOut.push({ id: g.id, n: g.name, r: g.rarity, i: imgIds });
      }

      // Inventory as dictionary keyed by image id (compact keys) - include stats and ability
      const inventoryOut = {};
      for (const it of state.inventory.values()) {
        inventoryOut[it.id] = { 
          c: it.count, 
          t: it.title, 
          g: it.groupName,
          hp: it.maxHp,
          atk: it.attack,
          ab: it.ability?.id || null,  // Save ability ID
        };
      }

      const payload = {
        schema: "custom-gacha-maker/v2",
        nextId: state.nextId,
        images: imagesDict,
        groups: groupsOut,
        inventory: inventoryOut,
      };

      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      hideBusy();
    }
  };

  // Import for schema v2 (fallback to v1 support)
  const importData = async (file) => {
    showBusy("Importing...");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const schema = payload?.schema;

      if (!schema || (schema !== "custom-gacha-maker/v2" && schema !== "custom-gacha-maker/v1")) {
        alert("Invalid or unsupported export file.");
        return;
      }

      // Clean existing
      state.groups.forEach(g => revokeImages(g.images));
      state.groups = [];
      state.inventory.clear();

      if (schema === "custom-gacha-maker/v2") {
        // Restore groups and images from compact dict
        const imagesDict = payload.images || {};
        const idToBlobUrl = {};

        // Pre-materialize blob URLs (retain IDs)
        for (const [imgId, meta] of Object.entries(imagesDict)) {
          idToBlobUrl[imgId] = await dataUrlToBlobUrl(meta.d);
        }

        for (const g of payload.groups || []) {
          const restoredImages = (g.i || []).map(id => ({
            id,
            name: imagesDict[id]?.n || "image",
            title: imagesDict[id]?.t || imagesDict[id]?.n || "image",
            url: idToBlobUrl[id]
          }));
          state.groups.push({ id: g.id, name: g.n, rarity: g.r, images: restoredImages });
        }

        state.nextId = Math.max(payload.nextId || 1, ...state.groups.map(g => g.id + 1), 1);

        // Inventory
        for (const [imgId, entry] of Object.entries(payload.inventory || {})) {
          const owner = state.groups.find(g => g.images.some(img => img.id === imgId));
          const srcImg = owner?.images.find(img => img.id === imgId);
          if (!srcImg) continue;
          const clonedUrl = await cloneImageUrl(srcImg.url);
          const stats = (entry.hp && entry.atk) 
            ? { hp: entry.hp, attack: entry.atk }
            : window.GachaApp.calculateStats(owner?.rarity || 50);
          // Restore ability from ID or assign new one
          const ability = entry.ab 
            ? window.Abilities?.getAbilityById(entry.ab) 
            : window.Abilities?.getRandomAbility();
          state.inventory.set(imgId, {
            id: imgId,
            title: entry.t || srcImg.title,
            groupName: entry.g || owner?.name || "",
            groupRarity: owner?.rarity || 50,
            url: clonedUrl,
            count: entry.c || 1,
            maxHp: stats.hp,
            attack: stats.attack,
            ability: ability || null,
          });
        }
      } else {
        // Fallback: v1 (previous export format) - keep existing logic
        // Restore groups and images
        for (const g of payload.groups || []) {
          const restoredImages = [];
          for (const img of (g.images || [])) {
            const blobUrl = await dataUrlToBlobUrl(img.dataUrl);
            restoredImages.push({ id: img.id, name: img.name, title: img.title, url: blobUrl });
          }
          state.groups.push({ id: g.id, name: g.name, rarity: g.rarity, images: restoredImages });
        }
        state.nextId = Math.max(payload.nextId || 1, ...state.groups.map(g => g.id + 1), 1);
        for (const it of (payload.inventory || [])) {
          const imgOwner = state.groups.find(g => g.images.some(img => img.id === it.id));
          const srcImg = imgOwner?.images.find(img => img.id === it.id);
          if (!srcImg) continue;
          const clonedUrl = await cloneImageUrl(srcImg.url);
          const stats = window.GachaApp.calculateStats(imgOwner?.rarity || 50);
          const ability = window.Abilities?.getRandomAbility() || null;
          state.inventory.set(it.id, {
            id: it.id,
            title: it.title,
            groupName: imgOwner?.name || it.groupName,
            groupRarity: imgOwner?.rarity || 50,
            url: clonedUrl,
            count: it.count || 1,
            maxHp: stats.hp,
            attack: stats.attack,
            ability: ability,
          });
        }
      }

      render();
      renderInventory();
      alert("Import completed.");
    } catch (err) {
      console.error(err);
      alert("Failed to import file.");
    } finally {
      hideBusy();
    }
  };

  // Wire buttons
  exportBtn?.addEventListener("click", exportData);
  importBtn?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await importData(file);
    e.target.value = ""; // reset for next import
  });

  // Initial render
  render();
  renderInventory();
})();
