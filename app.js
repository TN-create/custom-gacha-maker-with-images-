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
    }
  };

  const refs = {
    createForm: document.getElementById("createGroupForm"),
    nameInput: document.getElementById("groupName"),
    rarityInput: document.getElementById("groupRarity"),
    groupsList: document.getElementById("groupsList"),
    rollOneBtn: document.getElementById("rollOneBtn"),
    rollTenBtn: document.getElementById("rollTenBtn"),
    results: document.getElementById("results"),
    overlay: document.getElementById("overlay"),
    particles: document.getElementById("particles"),
    skipBtn: document.getElementById("skipBtn"),
    // Modal
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
      onchange: (e) => handleFilesSelected(group.id, e.target.files, thumbs),
    });
    const uploadBtn = el("button", {
      class: "btn small",
      type: "button",
      onclick: () => uploadInput.click()
    }, "Add images");

    const deleteBtn = el("button", {
      class: "btn small danger",
      type: "button",
      onclick: () => {
        if (!confirm(`Delete group "${group.name}" and its ${group.images.length} image(s)?`)) return;
        revokeImages(group.images);
        state.groups = state.groups.filter(g => g.id !== group.id);
        render();
      }
    }, "Delete");

    const header = el("div", { class: "group-header" },
      nameInput,
      el("div", { class: "rarity-wrap" }, rarityInput, el("span", {}, "%")),
      uploadBtn,
      deleteBtn
    );

    const thumbs = el("div", { class: "thumb-grid" }, group.images.map(img => renderThumb(group, img)));

    const groupCard = el("div", { class: "group", dataset: { id: group.id } },
      header,
      el("div", { class: "row between" },
        el("small", { class: "muted" }, `${group.images.length} image(s)`),
        uploadInput
      ),
      thumbs
    );

    return groupCard;
  };

  // Render a group thumbnail with click-to-rename
  const renderThumb = (group, img) => {
    const remove = () => {
      group.images = group.images.filter(i => i.id !== img.id);
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

  // Weighted random selection by rarity among groups with images
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

  // Modal: star burst particles when image shows
  const burstStars = (count = 14) => {
    refs.burst.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      p.className = "particle star";
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      p.style.setProperty("--dx", dx + "px");
      p.style.setProperty("--dy", dy + "px");
      p.style.setProperty("--rot", (Math.random()*360).toFixed(0) + "deg");
      refs.burst.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  };

  // Modal viewer
  const openModal = (items, startIndex = 0) => {
    state.modal.items = items.slice();
    state.modal.index = Math.min(Math.max(0, startIndex), items.length - 1);
    state.modal.open = true;
    refs.modal.classList.remove("hidden");
    refs.modal.setAttribute("aria-hidden", "false");
    updateModal();
    // Keyboard nav
    document.addEventListener("keydown", onKeyNav);
  };

  const closeModal = () => {
    if (!state.modal.open) return;
    state.modal.open = false;
    refs.modal.classList.add("hidden");
    refs.modal.setAttribute("aria-hidden", "true");
    refs.burst.innerHTML = "";
    document.removeEventListener("keydown", onKeyNav);
  };

  const onKeyNav = (e) => {
    if (!state.modal.open) return;
    if (e.key === "Escape") { closeModal(); }
    else if (e.key === "ArrowRight") { nextModal(); }
    else if (e.key === "ArrowLeft") { prevModal(); }
  };

  const updateModal = () => {
    const items = state.modal.items;
    const i = state.modal.index;
    if (!items.length) return;
    const { group, img } = items[i];
    refs.modalImage.src = img.url;
    refs.modalImage.alt = img.title || img.name;
    refs.modalTitle.textContent = img.title || fileTitle(img.name);
    refs.modalGroup.textContent = group.name;
    refs.modalIndex.textContent = `${i + 1} / ${items.length}`;
    // Do not show future entries; hide thumbs (no population)
    refs.modalThumbs.innerHTML = "";
    // Emit stars on reveal
    burstStars(16);
  };

  const nextModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index + 1;
    if (n < state.modal.items.length) {
      state.modal.index = n;
      updateModal();
    }
  };
  const prevModal = () => {
    if (!state.modal.open) return;
    const n = state.modal.index - 1;
    if (n >= 0) {
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
    openModal(results, 0);
  };

  // Results rendering
  const showMessage = (text) => {
    refs.results.innerHTML = "";
    refs.results.append(
      el("div", { class: "card" }, el("div", { class: "muted" }, text))
    );
  };

  const showResults = (items) => {
    refs.results.innerHTML = "";
    if (items.length === 1) {
      const { group, img } = items[0];
      refs.results.append(
        el("div", { class: "result-card" },
          el("img", { src: img.url, alt: img.title || img.name }),
          el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
        )
      );
    } else {
      const grid = el("div", { class: "grid" },
        items.map(({ group, img }) =>
          el("div", { class: "result-card" },
            el("img", { src: img.url, alt: img.title || img.name }),
            el("div", { class: "meta" }, `${group.name} • ${img.title || fileTitle(img.name)}`)
          )
        )
      );
      refs.results.append(grid);
    }
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

  // Initial render
  render();
})();
