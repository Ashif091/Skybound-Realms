import * as THREE from 'three';

const ITEM_ICONS = {
  log: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="6" y="10" width="20" height="12" rx="3" fill="#6b4226"/><ellipse cx="6" cy="16" rx="3" ry="6" fill="#8b5a2b" stroke="#5c4033" stroke-width="1.5"/><ellipse cx="26" cy="16" rx="3" ry="6" fill="#d2a679" stroke="#6b4226" stroke-width="1.5"/><line x1="10" y1="12" x2="22" y2="12" stroke="#5c4033" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  crafting_bench: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="9" width="24" height="6" rx="1.5" fill="#d2a679" stroke="#5c4033" stroke-width="1.5"/><rect x="10" y="7" width="12" height="3" fill="#f8fafc" stroke="#38bdf8" stroke-width="0.8"/><rect x="6" y="15" width="4" height="12" fill="#5c4033"/><rect x="22" y="15" width="4" height="12" fill="#5c4033"/><rect x="11" y="15" width="3" height="9" fill="#3d281c"/><rect x="18" y="15" width="3" height="9" fill="#3d281c"/></svg>`,
  wood_wall: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="6" y="4" width="20" height="24" rx="2" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><line x1="6" y1="12" x2="26" y2="12" stroke="#5c3a21" stroke-width="1"/><line x1="6" y1="20" x2="26" y2="20" stroke="#5c3a21" stroke-width="1"/><line x1="16" y1="4" x2="16" y2="28" stroke="#5c3a21" stroke-width="1.2"/></svg>`,
  wood_wall_window: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="6" y="4" width="20" height="24" rx="2" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><rect x="11" y="10" width="10" height="10" rx="1" fill="#0284c7" stroke="#5c3a21" stroke-width="1.2" opacity="0.85"/><line x1="16" y1="10" x2="16" y2="20" stroke="#5c3a21" stroke-width="1"/><line x1="11" y1="15" x2="21" y2="15" stroke="#5c3a21" stroke-width="1"/></svg>`,
  wood_wall_door: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="6" y="4" width="20" height="24" rx="2" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><path d="M12 28V14H20V28" fill="#5c3a21" stroke="#3d281c" stroke-width="1.2"/></svg>`,
  wood_floor: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="10" width="24" height="12" rx="2" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><line x1="12" y1="10" x2="12" y2="22" stroke="#5c3a21" stroke-width="1.2"/><line x1="20" y1="10" x2="20" y2="22" stroke="#5c3a21" stroke-width="1.2"/></svg>`,
  wood_roof: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M4 18L16 6L28 18H4Z" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><rect x="6" y="18" width="20" height="6" fill="#8b5a2b" stroke="#5c3a21" stroke-width="1.2"/></svg>`,
  wood_stairs: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M4 26H28V20H22V14H16V8H10V26Z" fill="#9e6a38" stroke="#5c3a21" stroke-width="1.5"/><line x1="10" y1="26" x2="10" y2="8" stroke="#5c3a21" stroke-width="1"/><line x1="16" y1="26" x2="16" y2="14" stroke="#5c3a21" stroke-width="1"/><line x1="22" y1="26" x2="22" y2="20" stroke="#5c3a21" stroke-width="1"/></svg>`,
  wood_box: `<svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="4" y="14" width="24" height="13" rx="2" fill="#8b5a2b" stroke="#3d281c" stroke-width="1.5"/><path d="M4 14C4 9.5 8.5 6 16 6C23.5 6 28 9.5 28 14H4Z" fill="#a06d3b" stroke="#3d281c" stroke-width="1.5"/><rect x="3.5" y="13" width="25" height="3" fill="#d97706" stroke="#3d281c" stroke-width="1"/><rect x="9" y="6.5" width="3" height="20.5" fill="#eab308" stroke="#3d281c" stroke-width="0.8"/><rect x="20" y="6.5" width="3" height="20.5" fill="#eab308" stroke="#3d281c" stroke-width="0.8"/><circle cx="10.5" cy="9" r="0.6" fill="#3d281c"/><circle cx="10.5" cy="18" r="0.6" fill="#3d281c"/><circle cx="21.5" cy="9" r="0.6" fill="#3d281c"/><circle cx="21.5" cy="18" r="0.6" fill="#3d281c"/><rect x="14" y="12" width="4" height="6" rx="1" fill="#f59e0b" stroke="#3d281c" stroke-width="1"/><rect x="14.5" y="16" width="3" height="3" rx="0.5" fill="#78350f" stroke="#3d281c" stroke-width="0.6"/><line x1="4" y1="20" x2="28" y2="20" stroke="#5c4033" stroke-width="0.8"/></svg>`
};

/**
 * Inventory & Dedicated Crafting Table System
 * Supports 21 Max Stack Limit, Live 3D Avatar Projection, Empty Equipment Slots (No Emojis),
 * Vector SVG Icons, Dedicated White Wooden Board Crafting UI, and 6-Slot Storage Chest.
 */
export class InventorySystem {
  constructor() {
    this.totalSlots = 21;
    this.hotbarCount = 6;
    this.mainCount = 15;
    
    // Active selected hotbar index (0 to 5)
    this.selectedHotbar = 0;
    
    // Inventory slots array (0..5 = Hotbar, 6..20 = Main Inventory)
    this.slots = Array.from({ length: this.totalSlots }, (_, i) => ({
      id: i,
      item: null
    }));

    this.isOpen = false;
    this.isTableOpen = false;
    this.isStorageOpen = false;
    this.activeStorageBox = null;
    this.activeTab = 'build';
    this.draggedSlotIndex = null;

    // Mini 3D Avatar Projection State
    this.miniRenderer = null;
    this.miniScene = null;
    this.miniCamera = null;
    this.miniAvatarGroup = null;

    this.createUI();
    this.createCraftingTableModal();
    this.createStorageBoxModal();
    this.updateUI();
  }

  createUI() {
    // 0. Player Health Bar HUD (Positioned above Hotbar)
    const healthBarContainer = document.createElement('div');
    healthBarContainer.id = 'health-bar-hud';
    healthBarContainer.className = 'health-bar-hud';
    healthBarContainer.innerHTML = `
      <div class="health-track">
        <div id="health-fill-bar" class="health-fill" style="width: 100%;"></div>
      </div>
    `;
    document.body.appendChild(healthBarContainer);

    // 1. Hotbar HUD (Bottom Center)
    const hotbarContainer = document.createElement('div');
    hotbarContainer.id = 'hotbar-hud';
    hotbarContainer.className = 'hotbar-hud';

    for (let i = 0; i < this.hotbarCount; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = `hotbar-slot ${i === this.selectedHotbar ? 'selected' : ''}`;
      slotEl.dataset.index = i;

      slotEl.innerHTML = `
        <span class="slot-num">${i + 1}</span>
        <div class="slot-icon"></div>
        <span class="slot-count"></span>
      `;

      slotEl.addEventListener('click', () => {
        if (!this.isOpen && !this.isTableOpen) {
          this.selectHotbar(i);
        }
      });

      hotbarContainer.appendChild(slotEl);
    }
    document.body.appendChild(hotbarContainer);

    // 2. Full Inventory Overlay (E Key)
    const invOverlay = document.createElement('div');
    invOverlay.id = 'inventory-overlay';
    invOverlay.className = 'inventory-overlay hidden';

    invOverlay.innerHTML = `
      <div class="inventory-modal">
        <div class="inv-header">
          <h2>Inventory & Crafting</h2>
          <div class="inv-header-actions">
            <span class="close-hint">Press <kbd>E</kbd> or <kbd>Esc</kbd> to Close</span>
            <button class="inv-close-btn" id="btn-close-inventory" title="Close Inventory">✕</button>
          </div>
        </div>

        <div class="inv-body-layout">
          <!-- Left Panel: Equipment Slots, 3D Avatar Projection & Crafting Table -->
          <div class="inv-left-panel">
            <div class="equipment-avatar-container">
              <!-- 4 Empty Equipment Slots (No Emojis) -->
              <div class="equipment-slots">
                <div class="equip-slot" data-slot="head" title="Headwear Slot">
                  <span class="equip-label">Head</span>
                </div>
                <div class="equip-slot" data-slot="shirt" title="Shirt / Armor Slot">
                  <span class="equip-label">Shirt</span>
                </div>
                <div class="equip-slot" data-slot="pants" title="Pants Slot">
                  <span class="equip-label">Pants</span>
                </div>
                <div class="equip-slot" data-slot="boots" title="Boots Slot">
                  <span class="equip-label">Boots</span>
                </div>
              </div>

              <!-- 3D Mini Live Projected Avatar Viewport -->
              <div class="avatar-preview-box">
                <canvas id="inv-avatar-canvas" width="150" height="170"></canvas>
                <span class="avatar-preview-name" id="inv-avatar-name">Steve</span>
              </div>
            </div>

            <!-- Crafting Table Action Card (Just Below Avatar) -->
            <div class="crafting-section">
              <div class="crafting-card" id="btn-craft-bench">
                <div class="craft-icon">${ITEM_ICONS.crafting_bench}</div>
                <div class="craft-details">
                  <span class="craft-title">Crafting Table</span>
                  <span class="craft-req">Requires: 2 Wood Logs</span>
                </div>
                <button class="btn-craft" type="button">Craft</button>
              </div>
            </div>
          </div>

          <!-- Right Panel: Main Inventory & Hotbar -->
          <div class="inv-right-panel">
            <div class="inv-section-title">Main Inventory (15 Slots)</div>
            <div id="main-inv-grid" class="inv-grid main-grid"></div>

            <div class="inv-section-title">Hotbar (Slots 1 - 6)</div>
            <div id="hotbar-inv-grid" class="inv-grid hotbar-grid"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(invOverlay);
    this.invOverlayEl = invOverlay;

    // Click outside modal to close inventory
    invOverlay.addEventListener('click', (e) => {
      if (e.target === invOverlay) {
        this.toggleInventory();
      }
    });

    const btnCloseInv = document.getElementById('btn-close-inventory');
    if (btnCloseInv) {
      btnCloseInv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleInventory();
      });
    }

    // Populate Inventory Modal Grids
    const mainGrid = document.getElementById('main-inv-grid');
    const hotbarGrid = document.getElementById('hotbar-inv-grid');

    for (let i = this.hotbarCount; i < this.totalSlots; i++) {
      mainGrid.appendChild(this.createModalSlotEl(i));
    }

    for (let i = 0; i < this.hotbarCount; i++) {
      hotbarGrid.appendChild(this.createModalSlotEl(i));
    }

    // Attach Crafting Table Click Listener
    const btnCraft = document.getElementById('btn-craft-bench');
    if (btnCraft) {
      btnCraft.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.craftBench();
      });
    }
  }

  /**
   * Dedicated Crafting Table Modal Overlay (Polished Wood Plank Aesthetic)
   */
  createCraftingTableModal() {
    const tableOverlay = document.createElement('div');
    tableOverlay.id = 'crafting-table-overlay';
    tableOverlay.className = 'inventory-overlay hidden';

    tableOverlay.innerHTML = `
      <div class="inventory-modal wood-plank-modal">
        <div class="inv-header board-header">
          <h2>Crafting Station</h2>
          <span class="close-hint">Press <kbd>Esc</kbd> to Close</span>
        </div>

        <!-- Crafting Category Sessions / Tabs -->
        <div class="craft-tabs board-tabs">
          <button class="craft-tab-btn" data-tab="basic">Basic</button>
          <button class="craft-tab-btn" data-tab="tools">Tools</button>
          <button class="craft-tab-btn active" data-tab="build">Build</button>
        </div>

        <!-- Boxed Slots Grid Container (Fixed Dimensions) -->
        <div id="crafting-recipe-grid" class="craft-boxed-grid"></div>
      </div>
    `;

    document.body.appendChild(tableOverlay);
    this.tableOverlayEl = tableOverlay;

    // Tab Switch Listeners
    const tabBtns = tableOverlay.querySelectorAll('.craft-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderCraftingRecipes();
      });
    });

    this.renderCraftingRecipes();
  }

  renderCraftingRecipes() {
    const grid = document.getElementById('crafting-recipe-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Calculate current total wood logs in inventory
    let currentLogCount = 0;
    for (let i = 0; i < this.totalSlots; i++) {
      if (this.slots[i].item && this.slots[i].item.type === 'log') {
        currentLogCount += this.slots[i].item.count;
      }
    }

    const recipes = {
      build: [
        { type: 'wood_wall', name: 'Wood Wall', cost: 2, costName: '2 Wood Logs', desc: 'Solid Vertical Wall Panel (Costs 2 Logs)' },
        { type: 'wood_wall_window', name: 'Wall with Window', cost: 2, costName: '2 Wood Logs', desc: 'Wall Panel with Window Frame Cutout (Costs 2 Logs)' },
        { type: 'wood_wall_door', name: 'Wall with Doorway', cost: 2, costName: '2 Wood Logs', desc: 'Wall Panel with Doorway Entrance Hole (Costs 2 Logs)' },
        { type: 'wood_floor', name: 'Wood Floor', cost: 1, costName: '1 Wood Log', desc: 'Flat Ground Floor Panel (Costs 1 Log)' },
        { type: 'wood_roof', name: 'Wood Roof', cost: 1, costName: '1 Wood Log', desc: 'Top Elevated Roof Panel (Costs 1 Log)' },
        { type: 'wood_stairs', name: 'Wooden Stairs', cost: 3, costName: '3 Wood Logs', desc: '4-Step Wooden Staircase to Reach Roofs & High Ground (Costs 3 Logs)' }
      ],
      basic: [
        { type: 'crafting_bench', name: 'Crafting Table', cost: 2, costName: '2 Wood Logs', desc: '4-Legged Wooden Crafting Station (Costs 2 Logs)' },
        { type: 'wood_box', name: 'Wooden Storage Box', cost: 6, costName: '6 Wood Logs', desc: '6-Slot Storage Chest to Store Items (Costs 6 Logs)' },
        { type: 'log', name: 'Wood Log Stack', cost: 1, costName: '1 Wood Log', desc: 'Timber Resource (Costs 1 Log)' }
      ],
      tools: []
    };

    const currentList = recipes[this.activeTab] || recipes.build;

    if (currentList.length === 0) {
      grid.innerHTML = `
        <div class="empty-tab-msg">
          <span>No tools unlocked yet. Harvest logs and craft basic items!</span>
        </div>
      `;
      return;
    }

    currentList.forEach(r => {
      const hasEnough = currentLogCount >= r.cost;
      const slotBox = document.createElement('div');
      slotBox.className = `craft-slot-box ${hasEnough ? 'available' : 'low-opacity'}`;
      slotBox.setAttribute('title', `${r.name}\n${r.desc}\nRequires: ${r.costName}`);

      slotBox.innerHTML = `
        <span class="craft-cost-tag">${r.cost} Logs</span>
        <div class="craft-slot-icon">${ITEM_ICONS[r.type] || ''}</div>
        <span class="craft-hover-name">${r.name}</span>
      `;

      slotBox.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.craftRecipeItem(r);
      });

      grid.appendChild(slotBox);
    });
  }

  craftRecipeItem(recipe) {
    let logCount = 0;
    for (let i = 0; i < this.totalSlots; i++) {
      if (this.slots[i].item && this.slots[i].item.type === 'log') {
        logCount += this.slots[i].item.count;
      }
    }

    if (logCount < recipe.cost) {
      this.showToast(`Need ${recipe.costName} to build ${recipe.name}!`);
      return false;
    }

    // Deduct logs
    let needed = recipe.cost;
    for (let i = 0; i < this.totalSlots && needed > 0; i++) {
      const item = this.slots[i].item;
      if (item && item.type === 'log') {
        const removeCount = Math.min(needed, item.count);
        item.count -= removeCount;
        needed -= removeCount;
        if (item.count <= 0) {
          this.slots[i].item = null;
        }
      }
    }

    this.addItem(recipe.type, 1, recipe.name);
    this.showToast(`Built 1x ${recipe.name}!`);
    this.updateUI();
    this.renderCraftingRecipes();
    return true;
  }

  openCraftingTableModal() {
    this.isTableOpen = true;
    if (this.tableOverlayEl) {
      this.tableOverlayEl.classList.remove('hidden');
    }
    this.renderCraftingRecipes();
    if (document.exitPointerLock) document.exitPointerLock();
  }

  closeCraftingTableModal() {
    this.isTableOpen = false;
    if (this.tableOverlayEl) {
      this.tableOverlayEl.classList.add('hidden');
    }
    if (document.body.requestPointerLock) document.body.requestPointerLock();
  }

  setupMiniAvatarRenderer(avatarInstance) {
    if (!avatarInstance || this.miniRenderer) return;

    const canvas = document.getElementById('inv-avatar-canvas');
    if (!canvas) return;

    this.miniScene = new THREE.Scene();
    this.miniCamera = new THREE.PerspectiveCamera(40, 150 / 170, 0.1, 100);
    this.miniCamera.position.set(0, 1.15, 3.6);
    this.miniCamera.lookAt(0, 0.95, 0);

    this.miniRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.miniRenderer.setSize(150, 170);
    this.miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.miniScene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(2, 4, 3);
    this.miniScene.add(dirLight);

    if (avatarInstance.group) {
      this.miniAvatarGroup = avatarInstance.group.clone();
      this.miniAvatarGroup.visible = true;
      this.miniAvatarGroup.position.set(0, -0.2, 0);

      // Remove overhead name tag from 3D mini projection to avoid double name display
      this.miniAvatarGroup.traverse((child) => {
        if (child.isMesh && child.material && child.material.map && child.material.map.isCanvasTexture) {
          child.visible = false;
        }
      });

      this.miniScene.add(this.miniAvatarGroup);
    }
  }

  updateMiniAvatar(deltaTime, avatarInstance = null) {
    if (!this.miniRenderer && avatarInstance) {
      this.setupMiniAvatarRenderer(avatarInstance);
    }

    if (this.isOpen && this.miniRenderer && this.miniAvatarGroup) {
      this.miniAvatarGroup.rotation.y += deltaTime * 0.8;
      this.miniRenderer.render(this.miniScene, this.miniCamera);
    }
  }

  showToast(msg) {
    let toast = document.getElementById('inv-toast-msg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'inv-toast-msg';
      toast.className = 'inv-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  /**
   * Crafts 1x Crafting Table if player has at least 2 Wood Logs
   */
  craftBench() {
    let logCount = 0;
    for (let i = 0; i < this.totalSlots; i++) {
      if (this.slots[i].item && this.slots[i].item.type === 'log') {
        logCount += this.slots[i].item.count;
      }
    }

    if (logCount < 2) {
      this.showToast('Need 2 Wood Logs to craft Crafting Table!');
      return false;
    }

    // Deduct 2 wood logs
    let needed = 2;
    for (let i = 0; i < this.totalSlots && needed > 0; i++) {
      const item = this.slots[i].item;
      if (item && item.type === 'log') {
        const removeCount = Math.min(needed, item.count);
        item.count -= removeCount;
        needed -= removeCount;
        if (item.count <= 0) {
          this.slots[i].item = null;
        }
      }
    }

    // Add 1 Crafting Table to inventory
    const added = this.addItem('crafting_bench', 1, 'Crafting Table');
    if (added) {
      this.showToast('Crafted 1x Crafting Table!');
    }
    this.updateUI();
    return true;
  }

  setAvatarName(name) {
    const el = document.getElementById('inv-avatar-name');
    if (el) el.textContent = name || 'Steve';
  }

  createModalSlotEl(index) {
    const slotEl = document.createElement('div');
    slotEl.className = 'inv-slot';
    slotEl.dataset.index = index;

    const slotNumText = index < this.hotbarCount ? `${index + 1}` : '';

    slotEl.innerHTML = `
      ${slotNumText ? `<span class="slot-num">${slotNumText}</span>` : ''}
      <div class="slot-icon"></div>
      <span class="slot-count"></span>
    `;

    slotEl.addEventListener('click', () => {
      this.handleSlotClick(index);
    });

    return slotEl;
  }

  handleSlotClick(index) {
    if (this.draggedSlotIndex === null) {
      if (this.slots[index].item) {
        this.draggedSlotIndex = index;
        this.updateUI();
      }
    } else {
      const source = this.draggedSlotIndex;
      const target = index;

      if (source !== target) {
        const temp = this.slots[target].item;
        this.slots[target].item = this.slots[source].item;
        this.slots[source].item = temp;
      }

      this.draggedSlotIndex = null;
      this.updateUI();
    }
  }

  selectHotbar(index) {
    if (index >= 0 && index < this.hotbarCount) {
      this.selectedHotbar = index;
      this.updateUI();
    }
  }

  toggleInventory() {
    if (this.isTableOpen) {
      this.closeCraftingTableModal();
      return;
    }
    if (this.isStorageOpen) {
      this.closeStorageBoxModal();
      return;
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.invOverlayEl.classList.remove('hidden');
      if (document.exitPointerLock) document.exitPointerLock();
    } else {
      this.invOverlayEl.classList.add('hidden');
      this.draggedSlotIndex = null;
      if (document.body.requestPointerLock) document.body.requestPointerLock();
    }
    this.updateUI();
  }

  /**
   * Adds item to inventory with max stack limit = 21
   */
  addItem(type = 'log', count = 1, name = null) {
    const itemType = type;
    const itemNames = {
      log: 'Wood Log',
      crafting_bench: 'Crafting Table',
      wood_box: 'Wooden Storage Box',
      wood_wall: 'Wood Wall',
      wood_wall_window: 'Wall with Window',
      wood_wall_door: 'Wall with Doorway',
      wood_floor: 'Wood Floor',
      wood_roof: 'Wood Roof'
    };
    const itemName = name || itemNames[type] || 'Item';
    const maxStack = 21;

    // 1. Try to add to existing item stack (capped at 21)
    for (let i = 0; i < this.totalSlots; i++) {
      const slotItem = this.slots[i].item;
      if (slotItem && slotItem.type === itemType && slotItem.count < maxStack) {
        const space = maxStack - slotItem.count;
        const addCount = Math.min(space, count);
        slotItem.count += addCount;
        count -= addCount;
        if (count <= 0) {
          this.updateUI();
          return true;
        }
      }
    }

    // 2. Add to empty slots
    while (count > 0) {
      let emptyIndex = -1;
      for (let i = 0; i < this.totalSlots; i++) {
        if (!this.slots[i].item) {
          emptyIndex = i;
          break;
        }
      }

      if (emptyIndex === -1) break;

      const addCount = Math.min(maxStack, count);
      this.slots[emptyIndex].item = {
        type: itemType,
        name: itemName,
        count: addCount
      };
      count -= addCount;
    }

    this.updateUI();
    return true;
  }

  getActiveItem() {
    return this.slots[this.selectedHotbar].item;
  }

  useActiveItem() {
    const item = this.getActiveItem();
    if (!item) return false;

    item.count -= 1;
    if (item.count <= 0) {
      this.slots[this.selectedHotbar].item = null;
    }
    this.updateUI();
    return true;
  }

  updateUI() {
    // 1. Update Hotbar HUD
    const hotbarSlots = document.querySelectorAll('#hotbar-hud .hotbar-slot');
    hotbarSlots.forEach((slotEl, i) => {
      slotEl.classList.toggle('selected', i === this.selectedHotbar);

      const item = this.slots[i].item;
      const iconEl = slotEl.querySelector('.slot-icon');
      const countEl = slotEl.querySelector('.slot-count');

      if (item) {
        iconEl.innerHTML = ITEM_ICONS[item.type] || '';
        countEl.textContent = item.count > 1 ? item.count : '';
      } else {
        iconEl.innerHTML = '';
        countEl.textContent = '';
      }
    });

    // 2. Update Inventory Modal Slots
    const modalSlots = document.querySelectorAll('.inventory-modal .inv-slot');
    modalSlots.forEach((slotEl) => {
      const index = parseInt(slotEl.dataset.index, 10);
      const item = this.slots[index].item;

      const iconEl = slotEl.querySelector('.slot-icon');
      const countEl = slotEl.querySelector('.slot-count');

      slotEl.classList.toggle('holding', index === this.draggedSlotIndex);

      if (item) {
        iconEl.innerHTML = ITEM_ICONS[item.type] || '';
        countEl.textContent = item.count > 1 ? item.count : '';
      } else {
        iconEl.innerHTML = '';
        countEl.textContent = '';
      }
    });
  }

  updateHealth(currentHp = 100, maxHp = 100) {
    const fillEl = document.getElementById('health-fill-bar');
    const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

    if (fillEl) {
      fillEl.style.width = `${pct}%`;
    }
  }

  /**
   * Creates DOM element for 6-Slot Wooden Storage Box Modal Window
   */
  createStorageBoxModal() {
    const storageOverlay = document.createElement('div');
    storageOverlay.id = 'storage-box-overlay';
    storageOverlay.className = 'inventory-overlay hidden';

    storageOverlay.innerHTML = `
      <div class="inventory-modal wood-plank-modal storage-modal">
        <div class="inv-header board-header">
          <h2>Wooden Storage Box</h2>
          <span class="close-hint">Click outside or press <kbd>Esc</kbd> to Close</span>
        </div>

        <div class="storage-modal-body">
          <div class="storage-section">
            <h3 class="section-title">Chest Storage (6 Slots)</h3>
            <div id="storage-box-slots" class="storage-grid"></div>
          </div>

          <div class="storage-divider"></div>

          <div class="storage-section">
            <h3 class="section-title">Player Inventory</h3>
            <div id="storage-player-slots" class="storage-grid player-inv-grid"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(storageOverlay);
    this.storageOverlayEl = storageOverlay;

    storageOverlay.addEventListener('click', (e) => {
      if (e.target === storageOverlay) {
        this.closeStorageBoxModal();
      }
    });
  }

  openStorageBoxModal(boxStructure) {
    if (!boxStructure) return;
    this.activeStorageBox = boxStructure;
    this.isStorageOpen = true;
    if (this.storageOverlayEl) {
      this.storageOverlayEl.classList.remove('hidden');
    }
    this.renderStorageBoxUI();
    if (document.exitPointerLock) document.exitPointerLock();
  }

  notifyStorageChange() {
    if (this.activeStorageBox && this.gameApp && this.gameApp.networkManager) {
      this.gameApp.networkManager.sendBoxStorageUpdate(
        this.activeStorageBox.x,
        this.activeStorageBox.z,
        this.activeStorageBox.storage
      );
      this.gameApp.networkManager.sendSaveInventory(
        this.getSlots(),
        this.gameApp.playerHp || 100
      );
    }
  }

  closeStorageBoxModal() {
    this.notifyStorageChange();
    this.isStorageOpen = false;
    this.activeStorageBox = null;
    if (this.storageOverlayEl) {
      this.storageOverlayEl.classList.add('hidden');
    }
    if (document.body.requestPointerLock) document.body.requestPointerLock();
  }

  renderStorageBoxUI() {
    if (!this.activeStorageBox) return;

    const boxGrid = document.getElementById('storage-box-slots');
    const playerGrid = document.getElementById('storage-player-slots');

    if (!boxGrid || !playerGrid) return;

    boxGrid.innerHTML = '';
    playerGrid.innerHTML = '';

    // 1. Render Box 6 Storage Slots
    for (let i = 0; i < 6; i++) {
      const slotItem = this.activeStorageBox.storage[i];
      const slotEl = document.createElement('div');
      slotEl.className = 'storage-slot-box';
      slotEl.dataset.boxIndex = i;

      if (slotItem) {
        slotEl.innerHTML = `
          <div class="slot-icon">${ITEM_ICONS[slotItem.type] || ''}</div>
          <span class="slot-count">${slotItem.count > 1 ? slotItem.count : ''}</span>
          <span class="slot-name-hover">${slotItem.name || slotItem.type}</span>
        `;
      } else {
        slotEl.innerHTML = `<span class="empty-slot-label">Empty</span>`;
      }

      slotEl.addEventListener('click', () => {
        this.transferFromBoxToPlayer(i);
      });

      boxGrid.appendChild(slotEl);
    }

    // 2. Render Player Inventory 21 Slots
    for (let j = 0; j < this.totalSlots; j++) {
      const pItem = this.slots[j].item;
      const slotEl = document.createElement('div');
      slotEl.className = 'storage-slot-box player-slot';
      slotEl.dataset.playerIndex = j;

      if (pItem) {
        slotEl.innerHTML = `
          <div class="slot-icon">${ITEM_ICONS[pItem.type] || ''}</div>
          <span class="slot-count">${pItem.count > 1 ? pItem.count : ''}</span>
          <span class="slot-name-hover">${pItem.name || pItem.type}</span>
        `;
      } else {
        slotEl.innerHTML = `<span class="empty-slot-label">Empty</span>`;
      }

      slotEl.addEventListener('click', () => {
        this.transferFromPlayerToBox(j);
      });

      playerGrid.appendChild(slotEl);
    }
  }

  transferFromPlayerToBox(playerSlotIndex) {
    if (!this.activeStorageBox) return;
    const pItem = this.slots[playerSlotIndex].item;
    if (!pItem || pItem.count <= 0) return;

    const maxStack = 21;
    let countToMove = pItem.count;

    // 1. Try to stack into existing box slot with matching type & space < 21
    for (let i = 0; i < 6; i++) {
      const bItem = this.activeStorageBox.storage[i];
      if (bItem && bItem.type === pItem.type && bItem.count < maxStack) {
        const space = maxStack - bItem.count;
        const addCount = Math.min(space, countToMove);
        bItem.count += addCount;
        countToMove -= addCount;
        if (countToMove <= 0) {
          this.slots[playerSlotIndex].item = null;
          this.showToast(`Stored ${pItem.name} in Box!`);
          this.updateUI();
          this.renderStorageBoxUI();
          this.notifyStorageChange();
          return;
        }
      }
    }

    // 2. Place in empty box slot
    if (countToMove > 0) {
      for (let i = 0; i < 6; i++) {
        if (!this.activeStorageBox.storage[i]) {
          this.activeStorageBox.storage[i] = {
            type: pItem.type,
            name: pItem.name,
            count: countToMove
          };
          countToMove = 0;
          this.slots[playerSlotIndex].item = null;
          this.showToast(`Stored ${pItem.name} in Box!`);
          this.updateUI();
          this.renderStorageBoxUI();
          this.notifyStorageChange();
          return;
        }
      }
    }

    // Partial move if stack overflowed
    if (countToMove < pItem.count) {
      pItem.count = countToMove;
      this.showToast(`Stored part of ${pItem.name} in Box!`);
    } else {
      this.showToast('Storage Box is full!');
    }

    this.updateUI();
    this.renderStorageBoxUI();
    this.notifyStorageChange();
  }

  transferFromBoxToPlayer(boxSlotIndex) {
    if (!this.activeStorageBox) return;
    const bItem = this.activeStorageBox.storage[boxSlotIndex];
    if (!bItem || bItem.count <= 0) return;

    const added = this.addItem(bItem.type, bItem.count, bItem.name);
    if (added) {
      this.showToast(`Retrieved ${bItem.name} from Box!`);
      this.activeStorageBox.storage[boxSlotIndex] = null;
    } else {
      this.showToast('Player inventory full!');
    }

    this.updateUI();
    this.renderStorageBoxUI();
    this.notifyStorageChange();
  }

  setAvatarName(name) {
    this.avatarName = name;
    const nameEl = document.getElementById('inv-avatar-name');
    if (nameEl) {
      nameEl.textContent = name;
    }
  }

  dropAllItems(dropX, dropZ, dropY, itemDropManager, networkManager) {
    if (this.isStorageOpen) this.closeStorageBoxModal();
    if (this.isTableOpen) this.closeCraftingTableModal();
    if (this.isOpen) this.toggleInventory();

    let itemsDropped = false;
    this.slots.forEach(slot => {
      if (slot && slot.item && slot.item.count > 0) {
        const itemType = slot.item.type;
        const count = slot.item.count;
        const rx = dropX + (Math.random() - 0.5) * 0.8;
        const rz = dropZ + (Math.random() - 0.5) * 0.8;

        if (itemDropManager) {
          const dropId = itemDropManager.spawnLogDrop(rx, rz, dropY, count, null, itemType);
          if (networkManager) {
            networkManager.sendDropLog(dropId, rx, rz, dropY, count, itemType);
          }
        }
        slot.item = null;
        itemsDropped = true;
      }
    });

    if (itemsDropped) {
      this.updateUI();
      if (networkManager) {
        networkManager.sendSaveInventory(this.getSlots(), 0);
      }
    }
  }

  /**
   * Clears all items from player inventory without dropping them (for void death)
   */
  clearAllItems(networkManager) {
    if (this.isStorageOpen) this.closeStorageBoxModal();
    if (this.isTableOpen) this.closeCraftingTableModal();
    if (this.isOpen) this.toggleInventory();

    this.slots.forEach(slot => {
      slot.item = null;
    });

    this.updateUI();
    if (networkManager) {
      networkManager.sendSaveInventory(this.getSlots(), 0);
    }
  }

  getSlots() {
    return this.slots.map(slot => slot.item ? { ...slot.item } : null);
  }

  restoreSlots(savedSlots) {
    if (!savedSlots || !Array.isArray(savedSlots)) return;
    for (let i = 0; i < this.totalSlots; i++) {
      if (savedSlots[i]) {
        this.slots[i].item = { ...savedSlots[i] };
      } else {
        this.slots[i].item = null;
      }
    }
    this.updateUI();
  }
}

