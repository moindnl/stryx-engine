<script lang="ts">
  import { Zap, Droplet, ChevronDown, ChevronRight, RotateCcw, User, UserX, Wheat, Check, RefreshCw, ExternalLink } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { linear, cubicOut, cubicIn } from 'svelte/easing';
  import { fly, fade, slide } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  const VERSION = '1.0';

  let updateAvailable = false;
  let doUpdateSW: () => Promise<void>;

  // Injected at build time by vite.config.js versionPlugin
  const BUILD_HASH = __BUILD_HASH__;

  const swUpdate = registerSW({
    async onNeedRefresh() {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`);
        if (!res.ok) { updateAvailable = true; return; } // can't check — show prompt
        const data = await res.json();
        if (data.hash !== BUILD_HASH) {
          updateAvailable = true;
        } else {
          swUpdate(false); // same build — apply silently
        }
      } catch {
        updateAvailable = true; // network error — show prompt anyway
      }
    },
    onOfflineReady() {},
  });
  doUpdateSW = swUpdate;

  let showAboutSheet = false;


  // Piecewise linear carb oxidation by IF (Jeukendrup 2004 / ACSM guidelines)
  function carbsFromIF(if_val: number): number {
    if (if_val <= 0)    return 0;
    if (if_val < 0.55)  return Math.round((if_val / 0.55) * 20);            // 0–20 g/h
    if (if_val < 0.75)  return Math.round(20 + (if_val - 0.55) / 0.20 * 20); // 20–40 g/h
    if (if_val < 0.90)  return Math.round(40 + (if_val - 0.75) / 0.15 * 20); // 40–60 g/h
    if (if_val < 1.05)  return Math.round(60 + (if_val - 0.90) / 0.15 * 30); // 60–90 g/h
    return Math.min(120, Math.round(90 + (if_val - 1.05) / 0.15 * 30));      // 90–120 g/h
  }

  const CARB_RANGES = {
    low:      { min: 30,  max: 45  },
    moderate: { min: 45,  max: 60  },
    high:     { min: 60,  max: 90  },
    extreme:  { min: 90,  max: 120 }
  } as const;

  const FLUID_RANGES = {
    low:      { min: 0.4, max: 0.5 },
    moderate: { min: 0.5, max: 0.7 },
    high:     { min: 0.7, max: 1.0 },
    extreme:  { min: 1.0, max: 1.2 }
  } as const;

  // Per-ride inputs (reset on Reset)
  let distance: number | undefined = undefined;
  let durationRaw = ''; // what user types — e.g. "1.30" or "1:30" or "1.5"
  let power: number | undefined = undefined;
  let temperature = 20; // °C — no heat bonus below 20°C; resets with ride

  // Parse "1:30", "1.30" (dot = minutes when 2+ digits), or "1.5" → decimal hours
  function parseDuration(raw: string): number {
    const s = raw.trim().replace(',', '.'); // normalize European comma separator
    if (!s) return 0;
    if (s.includes(':')) {
      const [hPart, mPart] = s.split(':');
      const h = parseFloat(hPart) || 0;
      const m = parseFloat(mPart) || 0;
      return Math.max(0, h + m / 60);
    }
    const dot = s.indexOf('.');
    if (dot !== -1) {
      const dec = s.slice(dot + 1);
      if (dec.length >= 2) {
        // "1.30" → 1h 30m
        const h = parseInt(s.slice(0, dot), 10) || 0;
        const m = Math.min(59, parseInt(dec.slice(0, 2), 10) || 0);
        return Math.max(0, h + m / 60);
      }
    }
    return Math.max(0, parseFloat(s) || 0);
  }

  // Display decimal hours as "1:30 h" in badges/labels
  function formatDuration(h: number): string {
    if (h <= 0) return '';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins === 0 ? `${hrs} h` : `${hrs}:${String(mins).padStart(2, '0')} h`;
  }

  $: duration = parseDuration(durationRaw);

  // Rider profile (persists via localStorage — read synchronously so guide renders correctly on first paint)
  let _savedProfile: Record<string, any> = {};
  try { _savedProfile = JSON.parse(localStorage.getItem('bp-profile') || '{}'); } catch { /* ignore */ }
  let weight: number | undefined = _savedProfile.weight > 0 ? _savedProfile.weight : undefined;
  let ftp: number | undefined = _savedProfile.ftp > 0 ? _savedProfile.ftp : undefined;
  let imperial: boolean = typeof _savedProfile.imperial === 'boolean' ? _savedProfile.imperial : false;
  let sweatRate: 'light' | 'moderate' | 'heavy' = _savedProfile.sweatRate || 'moderate';

  // UI state
  let showMathSheet = false;
  let showImpressumSheet = false;
  let profileOpen = !(weight > 0 || ftp > 0); // auto-open on first visit
  let rideOpen = false;
  let rideAutoCollapsed = false;
  let neuralizer = false;        // easter egg F: neuralyzer flash
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let totalsTab: 'summary' | 'schedule' | 'pack' = 'summary';
  let tabCard: HTMLElement;
  function switchTab(tab: typeof totalsTab) {
    totalsTab = tab;
    setTimeout(() => {
      if (!tabCard) return;
      const y = tabCard.getBoundingClientRect().top + window.scrollY - 76; // 64px header + 12px gap
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 0);
  }
  let checkedPack: Set<string> = new Set();
  function togglePack(id: string) {
    if (checkedPack.has(id)) checkedPack.delete(id); else checkedPack.add(id);
    checkedPack = checkedPack;
  }
  function resetPack() { checkedPack.clear(); checkedPack = checkedPack; }

  const SWEAT_LEVELS = [
    { value: 'light',    drops: 1 },
    { value: 'moderate', drops: 2 },
    { value: 'heavy',    drops: 3 },
  ] as const;

  // Bottle planner
  let bottleSize = 750; // ml

  // Nutrition products
  const SOLID_PRODUCTS = [
    { id: 'gel',   label: 'Gel',   carbs: 22 },
    { id: 'bar',   label: 'Bar',   carbs: 40 },
    { id: 'chew',  label: 'Chew',  carbs: 10 },
  ] as const;
  type SolidId = typeof SOLID_PRODUCTS[number]['id'];

  const DRINK_PRODUCTS = [
    { id: 'water',    label: 'Water only',  carbsPer500: 0  },
    { id: 'mix',      label: 'Carb mix',    carbsPer500: 36 },
    { id: 'isotonic', label: 'Isotonic',    carbsPer500: 30 },
  ] as const;
  type DrinkId = typeof DRINK_PRODUCTS[number]['id'];

  let solidProduct: SolidId = 'gel';
  let drinkProduct: DrinkId = 'water';

  // PWA install bottom sheet (null = hidden)
  let installPlatform: 'ios' | 'android' | null = null;
  let installSheetTimer: ReturnType<typeof setTimeout> | null = null;
  let _installOS: 'ios' | 'android' | null = null; // set in onMount if eligible
  let _installFired = false;

  // Fire install prompt on first meaningful engagement (profile complete)
  $: if (_installOS && !_installFired && weight > 0 && ftp > 0) {
    _installFired = true;
    installSheetTimer = setTimeout(() => { installPlatform = _installOS!; }, 800);
  }
  let deferredInstallPrompt: any = null;
  const onBeforeInstallPrompt = (e: Event) => { e.preventDefault(); deferredInstallPrompt = e; };
  const onAppInstalled = () => { installPlatform = null; };
  let sheetDragStartY = 0;
  let sheetDragOffsetY = 0;
  let sheetIsDragging = false;
  let _sheetDismiss: (() => void) | null = null;

  function onSheetDragStart(e: TouchEvent, dismiss: () => void) {
    _sheetDismiss = dismiss;
    sheetDragStartY = e.touches[0].clientY;
    sheetDragOffsetY = 0;
    sheetIsDragging = true;
  }
  function onSheetDragMove(e: TouchEvent) {
    if (!sheetIsDragging) return;
    e.preventDefault();
    sheetDragOffsetY = Math.max(0, e.touches[0].clientY - sheetDragStartY);
  }
  function onSheetDragEnd() {
    if (!sheetIsDragging) return;
    sheetIsDragging = false;
    if (sheetDragOffsetY > 80) {
      sheetDragOffsetY = window.innerHeight;
      setTimeout(() => {
        _sheetDismiss?.();
        _sheetDismiss = null;
        sheetDragOffsetY = 0;
      }, 260);
    } else {
      sheetDragOffsetY = 0;
    }
  }

  onMount(() => {
    // Easter egg: console greeting
    console.log('bonkproof — Cycling Nutrition Planner\n\nPsst. You\'re looking at the source.\nWhy are you not riding your bike?\n\nBuilt by Daniel Muschinski\nhttps://github.com/moindnl');

    const isMobile = window.innerWidth < 768;
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isMobile && !standalone && (isIos || isAndroid) && !localStorage.getItem('bp-install-dismissed')) {
      _installOS = isIos ? 'ios' : 'android'; // reactive block fires when profile complete
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    _profileReady = true;
  });

  onDestroy(() => {
    if (installSheetTimer) clearTimeout(installSheetTimer);
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  function dismissInstallSheet() {
    installPlatform = null;
    sheetDragOffsetY = 0;
    sheetIsDragging = false;
    localStorage.setItem('bp-install-dismissed', '1');
  }
  async function triggerInstall() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') installPlatform = null;
  }
  // Only save after initial load — debounced to avoid writing on every keystroke
  let _profileReady = false;
  let _saveTimer: ReturnType<typeof setTimeout> | null = null;
  $: if (_profileReady) {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      localStorage.setItem('bp-profile', JSON.stringify({ weight, ftp, imperial, sweatRate }));
    }, 600);
  }

  // Guide: hide once both weight + ftp set; never re-show (avoids flicker on delete)
  let _guideSeen = false;
  $: if (weight > 0 && ftp > 0) _guideSeen = true;

  // Reset per-ride inputs only; profile persists
  function resetInputs() {
    distance = undefined; durationRaw = ''; power = undefined; temperature = 20;
    rideOpen = true; rideAutoCollapsed = false;
  }

  // Easter egg F: hold Reset 3s → neuralyzer flash
  function startHold() {
    holdTimer = setTimeout(() => {
      resetInputs();
      neuralizer = true;
      setTimeout(() => { neuralizer = false; }, 2900);
    }, 2000);
  }
  function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  // Imperial ↔ metric: convert displayed values on toggle
  function toggleImperial() {
    if (!imperial) {
      if (weight != null && weight > 0)   weight   = Math.round(weight * 2.20462);
      if (distance != null && distance > 0) distance = Math.round(distance * 0.621371 * 10) / 10;
    } else {
      if (weight != null && weight > 0)   weight   = Math.round(weight / 2.20462);
      if (distance != null && distance > 0) distance = Math.round(distance * 1.60934);
    }
    imperial = !imperial;
  }

  // Metric-normalised values used in all calculations
  $: weightKg   = imperial ? (weight ?? 0) / 2.20462 : (weight ?? 0);
  $: distanceKm = imperial ? (distance ?? 0) * 1.60934 : (distance ?? 0);
  $: speedKmh   = distanceKm > 0 && duration > 0 ? distanceKm / duration : 0;
  $: speedUnit  = imperial ? 'mph' : 'km/h';
  $: heatBonus  = temperature > 20 ? Math.round((temperature - 20) / 5 * 0.3 * 10) / 10 : 0;
  $: sweatMultiplier = sweatRate === 'light' ? 0.8 : sweatRate === 'heavy' ? 1.3 : 1.0;


  // Power-derived zone
  $: intensityFactor = ftp > 0 && power > 0 ? power / ftp : 0;
  $: powerDerived = intensityFactor > 0;

  // 🥚 Easter egg B: Tadej mode at ≥500W
  $: tadejMode = power >= 500;


  $: zoneLabel = intensityFactor === 0 ? '' :
    tadejMode ? 'ARE YOU OKAY?!' :
    intensityFactor < 0.55 ? 'Recovery' :
    intensityFactor < 0.75 ? 'Endurance' :
    intensityFactor < 0.90 ? 'Tempo' :
    intensityFactor < 1.05 ? 'Threshold' :
    'VO₂max+';

  $: zoneBadgeStyle = intensityFactor === 0 ? '' :
    tadejMode
      ? 'background:#f0c000;color:#111111;transition:background 0.35s ease,color 0.35s ease'
      : `background:${
          intensityFactor < 0.55 ? '#a1a1aa' :
          intensityFactor < 0.90 ? '#3f3f46' :
          '#f73b20'
        };color:#ffffff;transition:background 0.35s ease,color 0.35s ease`;


  $: intensity = (intensityFactor === 0 ? 'moderate' :
    intensityFactor < 0.65 ? 'low' :
    intensityFactor <= 0.80 ? 'moderate' :
    intensityFactor < 0.95 ? 'high' :
    'extreme') as keyof typeof CARB_RANGES;

  // Fluid: weight-scaled + sweat rate + heat adjustment
  $: baseFluid = (FLUID_RANGES[intensity].min + FLUID_RANGES[intensity].max) / 2;
  $: fluidPerHour = weight > 0 && duration > 0 ? baseFluid * (weightKg / 70) * sweatMultiplier + heatBonus : 0;

  // Carbs: IF-based piecewise when power available, zone midpoint fallback
  $: carbsPerHour = !duration || !(weight > 0) ? 0 :
    powerDerived
      ? carbsFromIF(intensityFactor)
      : Math.round((CARB_RANGES[intensity].min + CARB_RANGES[intensity].max) / 2);

  // Energy: kJ mechanical ≈ kcal (cycling standard: 1W × 1h = 3.6 kJ ≈ 3.6 kcal)
  $: kcalPerHour = powerDerived ? Math.round(power * 3.6) : 0;

  // Speed (display unit depends on imperial; animal thresholds always km/h)
  $: speedDisplay = Math.round(imperial ? speedKmh * 0.621371 : speedKmh);

  // Totals
  $: totalCarbs = Math.round(carbsPerHour * duration);
  $: totalFluid = fluidPerHour * duration;
  $: totalKcal  = Math.round(kcalPerHour * duration);

  // Animations
  const TWEEN = { duration: 400, easing: linear };
  const animatedCarbs       = tweened(carbsPerHour, TWEEN);
  const animatedFluid       = tweened(fluidPerHour, TWEEN);
  const animatedSpeed       = tweened(speedDisplay,  TWEEN);
  const animatedTotalCarbs  = tweened(totalCarbs,    TWEEN);
  const animatedTotalFluid  = tweened(totalFluid,    TWEEN);
  const animatedTotalKcal   = tweened(totalKcal,     TWEEN);
  const animatedKcalPerHour = tweened(kcalPerHour,   TWEEN);

  $: animatedCarbs.set(carbsPerHour);
  $: animatedFluid.set(fluidPerHour);
  $: animatedSpeed.set(speedDisplay);
  $: animatedTotalCarbs.set(totalCarbs);
  $: animatedTotalFluid.set(totalFluid);
  $: animatedTotalKcal.set(totalKcal);
  $: animatedKcalPerHour.set(kcalPerHour);

  const animalLinks: Record<string, string> = {
    'Turtle pace':            'https://en.wikipedia.org/wiki/Turtle',
    'Penguin cruise':         'https://en.wikipedia.org/wiki/Penguin',
    'Gazelle pace':           'https://en.wikipedia.org/wiki/Gazelle',
    'Cheetah chase':          'https://en.wikipedia.org/wiki/Cheetah',
    'Falcon flight':          'https://en.wikipedia.org/wiki/Falcon',
    'Peregrine speed':        'https://en.wikipedia.org/wiki/Peregrine_falcon',
    'Greyhound sprint':       'https://en.wikipedia.org/wiki/Greyhound',
    // 🥚 Easter egg E: beyond greyhound
    'Downhill record':    'https://en.wikipedia.org/wiki/%C3%89ric_Barone',
    'Motorcycle territory': 'https://en.wikipedia.org/wiki/Motorcycle',
    'Please call an ambulance': 'https://en.wikipedia.org/wiki/Ambulance',
  };

  $: speedSlogan = speedKmh === 0 ? '' :
    speedKmh < 10 ? 'Turtle pace' :
    speedKmh < 15 ? 'Penguin cruise' :
    speedKmh < 20 ? 'Gazelle pace' :
    speedKmh < 25 ? 'Cheetah chase' :
    speedKmh < 30 ? 'Falcon flight' :
    speedKmh < 40 ? 'Peregrine speed' :
    speedKmh < 55 ? 'Greyhound sprint' :
    speedKmh < 75 ? 'Downhill record' :
    speedKmh < 100 ? 'Motorcycle territory' :
    'Please call an ambulance';

  $: multiCarbNote = intensityFactor >= 0.90;

  // Auto-collapse ride card when focus leaves it and all fields are filled
  function handleRideCardFocusOut(e: FocusEvent) {
    const related = e.relatedTarget as Node | null;
    const card = e.currentTarget as Node;
    if (!card.contains(related) && distance > 0 && duration > 0 && power > 0 && !rideAutoCollapsed) {
      rideOpen = false;
      rideAutoCollapsed = true;
    }
  }

  // Active products
  $: activeSolid = SOLID_PRODUCTS.find(p => p.id === solidProduct)!;
  $: activeDrink = DRINK_PRODUCTS.find(p => p.id === drinkProduct)!;
  $: solidLabel = activeSolid.label.toLowerCase();

  // Bottle planner
  $: bottleCount        = weight > 0 && duration > 0 && totalFluid > 0 ? Math.ceil(totalFluid * 1000 / bottleSize) : 0;
  $: mlPerBottle        = bottleCount > 0 ? Math.round(totalFluid * 1000 / bottleCount) : 0;
  $: drinkCarbsPerHour  = fluidPerHour > 0 ? Math.round(activeDrink.carbsPer500 * (fluidPerHour * 1000 / 500)) : 0;
  $: drinkCarbsPerBottle = bottleCount > 0 ? Math.round(activeDrink.carbsPer500 * mlPerBottle / 500) : 0;

  // Solid food covers carbs not met by drink
  $: solidCarbsPerHour = Math.max(0, carbsPerHour - drinkCarbsPerHour);
  $: carbsPerBottle    = bottleCount > 0 ? Math.round((totalCarbs - drinkCarbsPerHour * duration) / bottleCount) : 0;
  $: totalSolidUnits = duration > 0 && activeSolid.carbs > 0 ? Math.ceil(solidCarbsPerHour * duration / activeSolid.carbs) : 0;

  $: packItems = (() => {
    if (!duration || !weight) return [] as { id: string; label: string }[];
    const items: { id: string; label: string }[] = [];
    if (totalSolidUnits > 0) {
      const withEmergency = duration >= 2;
      const count = withEmergency ? totalSolidUnits + 1 : totalSolidUnits;
      const suffix = withEmergency ? ', +1 emergency' : '';
      items.push({ id: 'fuel', label: `${count} × ${solidLabel} (${activeSolid.carbs}g each${suffix})` });
    }
    if (bottleCount > 0)
      items.push({ id: 'bottles', label: `${bottleCount} × bottle (${bottleSize}ml)` });
    if (drinkProduct !== 'water' && bottleCount > 0)
      items.push({ id: 'carbdrink', label: `${activeDrink.label} mix — ${bottleCount} serving${bottleCount > 1 ? 's' : ''}` });
    if (temperature >= 28)
      items.push({ id: 'electrolytes', label: 'Electrolyte tabs / salt caps' });
    if (duration >= 3)
      items.push({ id: 'cash', label: 'Cash or card (café stop / emergency)' });
    items.push({ id: 'computer', label: 'Bike computer charged' });
    items.push({ id: 'phone', label: 'Phone charged' });
    return items;
  })();
  // Prune checked state for items that no longer exist
  $: {
    const validIds = new Set(packItems.map(i => i.id));
    let pruned = false;
    checkedPack.forEach(id => { if (!validIds.has(id)) { checkedPack.delete(id); pruned = true; } });
    if (pruned) checkedPack = checkedPack;
  }

  // Fueling schedule: 20-min intake slots (solid food only)
  $: fuelingEvents = (() => {
    if (!duration || !(weight > 0)) return [] as { time: string; carbs: number; units: number }[];
    const events: { time: string; carbs: number; units: number }[] = [];
    const totalMins = Math.round(duration * 60);
    const carbsPerSlot = Math.round(solidCarbsPerHour / 3);
    const units = carbsPerSlot > 0 ? Math.ceil(carbsPerSlot / activeSolid.carbs) : 0;
    for (let t = 20; t <= totalMins; t += 20) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      events.push({ time: `${h}:${String(m).padStart(2, '0')}`, carbs: carbsPerSlot, units });
    }
    return events;
  })();

  // Scroll input into view after keyboard appears (mobile)
  function focusInput(e: FocusEvent) {
    const el = e.target as HTMLInputElement;
    el.select();
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
  }


  const HOW_TO_STEPS = [
    { n: '1', title: 'Set up your profile', body: 'Enter weight, FTP, and your preferences once — they save automatically.' },
    { n: '2', title: 'Enter your ride', body: 'Add distance, duration, and planned power for this specific ride.' },
    { n: '3', title: 'Read results', body: 'Get precise carbohydrate and fluid targets based on your power output.' },
  ];

  function tabStyle(tab: string, active: string): string {
    return `${active === tab ? 'background:#ffffff;color:#09090b;' : 'background:transparent;color:rgba(255,255,255,0.65);'}flex:1;padding:6px 10px;border-radius:18px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;`;
  }
</script>

<main class="min-h-screen">

  <!-- Update toast -->
  {#if updateAvailable}
    <div class="fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-3 px-4 pointer-events-none"
      transition:fly={{ y: -48, duration: 300, easing: cubicOut }}>
      <div class="inline-flex items-center gap-sm rounded-full pointer-events-auto"
        style="background:#09090b;color:#ffffff;box-shadow:0 4px 20px rgba(0,0,0,0.35);padding:6px 6px 6px 16px;">
        <RefreshCw class="w-3.5 h-3.5 flex-shrink-0" style="color:rgba(255,255,255,0.55);" />
        <span class="text-caption-sm" style="color:rgba(255,255,255,0.8);">New version available</span>
        <button on:click={() => doUpdateSW()}
          class="text-caption-sm font-extra-bold rounded-full"
          style="background:#09090b;color:#ffffff;padding:6px 14px;white-space:nowrap;box-shadow:rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset,rgba(117,123,133,0.4) 0px 9px 14px -5px inset,rgb(44,46,52) 0px 0px 0px 1.5px,rgba(0,0,0,0.14) 0px 4px 6px 0px;">Update now</button>
      </div>
    </div>
  {/if}

  <!-- App Header — floating bar -->
  <header class="w-full" style="padding:calc(env(safe-area-inset-top) + 12px) 16px 0;position:sticky;top:0;z-index:100;">
    <div style="max-width:640px;margin:0 auto;height:52px;background:#09090b;border-radius:9999px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset,rgba(117,123,133,0.4) 0px 9px 14px -5px inset,rgb(44,46,52) 0px 0px 0px 1.5px,rgba(0,0,0,0.14) 0px 4px 6px 0px;">
      <!-- Logo -->
      <div class="flex items-center gap-sm">
        <img src="/favicon.svg" alt="" style="width:34px;height:34px;display:block;flex-shrink:0;border-radius:24%;box-shadow:0 0 0 2px #f73b20;" />
        <h1 style="margin:0;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">bonkproof</h1>
      </div>
      <!-- Right -->
      <div class="flex items-center gap-sm">
        <!-- Profile icon: User when set, UserX when empty -->
        <button
          class="flex items-center justify-center"
          style="width:34px;height:34px;border-radius:50%;background:#ffffff;"
          on:click={() => { profileOpen = !profileOpen; if (profileOpen) rideOpen = false; }}
          aria-label="{weight > 0 && ftp > 0 ? 'Rider profile' : 'Set up rider profile'}">
          {#if weight > 0 && ftp > 0}
            <User class="w-4 h-4" style="color:#09090b;" />
          {:else}
            <UserX class="w-4 h-4" style="color:#09090b;" />
          {/if}
        </button>
        {#if updateAvailable}
          <button class="text-caption-sm font-bold flex items-center gap-xs"
            style="background:#ffffff;color:#09090b;border-radius:9999px;padding:5px 12px;"
            on:click={() => doUpdateSW()}>
            <RefreshCw class="w-3 h-3" />
            Update
          </button>
        {/if}
      </div>
    </div>
  </header>


  <div class="max-w-6xl mx-auto p-sm md:p-md lg:p-lg" style="padding-top:12px;">

    <!-- 3-step how-to — shown on first visit or on demand -->
    {#if !_guideSeen}
    <div transition:fade={{ duration: 200 }} class="mb-lg md:mb-section card-enter card-enter-1">
      <!-- Mobile: horizontal swipe cards -->
      <div class="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-sm pb-sm -mx-sm px-sm" style="scrollbar-width:none;-webkit-overflow-scrolling:touch;" tabindex="0" role="region" aria-label="Result cards">
        {#each HOW_TO_STEPS as step, i}
          <div class="snap-center shrink-0 w-[78%] overflow-hidden shimmer-once flex" style="background:#ececee;border-radius:28px;--shimmer-delay:{0.5 + i * 0.1}s"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center flex-shrink-0" style="background:#09090b;min-width:56px;padding:0 18px 0 14px;clip-path:polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);">
              <span class="text-lg font-bold" style="color:#ffffff;">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{step.title}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{step.body}</p>
            </div>
          </div>
        {/each}
      </div>
      <!-- Desktop: 3-column grid -->
      <div class="hidden md:grid grid-cols-3 gap-lg overflow-hidden" style="background:#ececee;border-radius:28px;">
        {#each HOW_TO_STEPS as step, i}
          <div class="flex flex-col"
            in:fly={{ y: 18, duration: 320, delay: 80 + i * 70, easing: cubicOut }}>
            <div class="flex items-center justify-center py-md" style="background:#09090b;">
              <span class="text-lg font-bold" style="color:#ffffff;">{step.n}</span>
            </div>
            <div class="p-lg space-y-xs flex-1">
              <h2 class="text-body-strong font-bold text-[--color-ink]">{step.title}</h2>
              <p class="text-caption-md text-[--color-charcoal]">{step.body}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    {/if}

    <!-- Unified setup card -->
    <div class="mb-lg card-enter card-enter-2" style="background:#ffffff;border-radius:36px;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.04) 0px 4px 12px 0px;overflow:hidden;">

    <!-- Rider Profile -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer focus:outline-none"
        on:click={() => { profileOpen = !profileOpen; if (profileOpen) rideOpen = false; }}
        aria-expanded={profileOpen}
      >
        <span class="text-heading-md font-bold text-[--color-ink]">Rider Profile</span>
        <div class="flex items-center gap-md">
          {#if !profileOpen}
            <span class="text-caption-sm text-[--color-mute]">
              {#if weight > 0 || ftp > 0}
                {[weight ? `${weight} ${imperial ? 'lbs' : 'kg'}` : null, ftp ? `${ftp} W` : null].filter(Boolean).join(' · ')}
              {:else}
                Not set
              {/if}
            </span>
          {/if}
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-200 {profileOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if profileOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;">

          <!-- Weight -->
          <div class="flex items-center justify-between py-lg">
            <label for="weight" class="text-caption-md font-bold text-[--color-ink]">Body Weight</label>
            <div class="flex items-center gap-xs">
              <input id="weight" type="number" bind:value={weight} min="1" max="400" step="1" placeholder="75"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;border:1px solid #d4d4d8;padding:0 14px;background:#fff;"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>

          <!-- FTP -->
          <div class="flex items-center justify-between py-lg" style="border-top:1px solid #ececee;">
            <div>
              <label for="ftp" class="text-caption-md font-bold text-[--color-ink] block">FTP</label>
              <span class="text-caption-sm text-[--color-mute]">Max 1-hour power</span>
            </div>
            <div class="flex items-center gap-xs">
              <input id="ftp" type="number" bind:value={ftp} min="0" max="600" step="1" placeholder="280"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;border:1px solid #d4d4d8;padding:0 14px;background:#fff;"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">W</span>
            </div>
          </div>

          <!-- Units -->
          <div class="flex items-center justify-between py-lg gap-md flex-wrap" style="border-top:1px solid #ececee;">
            <span class="text-caption-md font-bold text-[--color-ink]">Units</span>
            <div style="display:flex;border-radius:14px;border:1px solid #d4d4d8;overflow:hidden;background:#f4f4f5;">
              <button
                style="{!imperial ? 'background:#09090b;color:#ffffff;' : 'background:transparent;color:#71717a;'}padding:8px 18px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                on:click={() => { if (imperial) toggleImperial(); }}>km / kg</button>
              <button
                style="{imperial ? 'background:#09090b;color:#ffffff;' : 'background:transparent;color:#71717a;'}padding:8px 18px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                on:click={() => { if (!imperial) toggleImperial(); }}>mi / lbs</button>
            </div>
          </div>

          <!-- Sweat Rate -->
          <div class="flex items-center justify-between py-lg gap-md" style="border-top:1px solid #ececee;">
            <div class="flex-shrink-0">
              <span class="text-caption-md font-bold text-[--color-ink] block">Sweat Rate</span>
              <span class="text-caption-sm text-[--color-mute]">
                {sweatRate === 'light' ? '−20% fluid' : sweatRate === 'heavy' ? '+30% fluid' : 'Baseline'}
              </span>
            </div>
            <div style="display:flex;border-radius:14px;border:1px solid #d4d4d8;overflow:hidden;background:#f4f4f5;flex-shrink:0;">
              {#each SWEAT_LEVELS as { value, drops }}
                <button
                  class="flex items-center gap-[2px]"
                  style="{sweatRate === value ? 'background:#09090b;color:#ffffff;' : 'background:transparent;color:#71717a;'}padding:8px 16px;transition:background 0.15s,color 0.15s;"
                  aria-label="{value.charAt(0).toUpperCase() + value.slice(1)} sweat rate"
                  aria-pressed={sweatRate === value}
                  on:click={() => (sweatRate = value)}>
                  {#each { length: drops } as _}<Droplet class="w-3.5 h-3.5" />{/each}
                </button>
              {/each}
            </div>
          </div>


        </div>
      {/if}
    </div>

    <!-- Ride Input -->
    <div>
      <button
        class="w-full flex items-center justify-between p-lg text-left cursor-pointer focus:outline-none"
        on:click={() => { rideOpen = !rideOpen; if (rideOpen) profileOpen = false; }}
        aria-expanded={rideOpen}
      >
        <span class="text-heading-md font-bold text-[--color-ink]">Ride</span>
        <div class="flex items-center gap-md">
          {#if !rideOpen}
            <span class="text-caption-sm text-[--color-mute]">
              {#if duration > 0 || power > 0}
                {[duration > 0 ? formatDuration(duration) : null, power > 0 ? `${power} W` : null, temperature !== 20 ? `${temperature}°C` : null].filter(Boolean).join(' · ')}
              {:else}
                Not set
              {/if}
            </span>
          {/if}
          <ChevronDown class="w-4 h-4 text-[--color-ink] transition-transform duration-200 {rideOpen ? 'rotate-180' : ''}" />
        </div>
      </button>

      {#if rideOpen}
        <div transition:slide={{ duration: 260, easing: cubicOut }} class="px-lg" style="padding-bottom:24px;"
          on:focusout={handleRideCardFocusOut}>

          <!-- Distance -->
          <div class="flex items-center justify-between py-lg">
            <label for="distance" class="text-caption-md font-bold text-[--color-ink]">
              Distance <span class="text-caption-sm text-[--color-mute] font-normal">(optional)</span>
            </label>
            <div class="flex items-center gap-xs">
              <input id="distance" type="number" bind:value={distance} min="1" max="500" step="1" placeholder="0"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;border:1px solid #d4d4d8;padding:0 14px;background:#fff;"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">{imperial ? 'mi' : 'km'}</span>
            </div>
          </div>

          <!-- Duration -->
          <div class="flex items-center justify-between py-lg" style="border-top:1px solid #ececee;">
            <div>
              <label for="duration" class="text-caption-md font-bold text-[--color-ink] block">Duration</label>
              <p class="text-utility-xs text-[--color-stone] mt-xxs">e.g. 1:30 or 1.5 for 1h 30min</p>
            </div>
            <div class="flex items-center gap-xs">
              <input id="duration" type="text" inputmode="decimal" bind:value={durationRaw}
                placeholder="1:30"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;border:1px solid #d4d4d8;padding:0 14px;background:#fff;"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">h</span>
            </div>
          </div>

          <!-- Power -->
          <div class="flex items-center justify-between py-lg" style="border-top:1px solid #ececee;">
            <div>
              <label for="power" class="text-caption-md font-bold text-[--color-ink] block">Ride Power</label>
              <span class="text-caption-sm text-[--color-mute]">Planned average</span>
            </div>
            <div class="flex items-center gap-xs">
              <input id="power" type="number" bind:value={power} min="0" max="600" step="1" placeholder="200"
                class="w-24 text-right text-body-strong text-[--color-ink] focus:outline-none"
                style="height:44px;border-radius:14px;border:1px solid #d4d4d8;padding:0 14px;background:#fff;"
                on:focus={focusInput} />
              <span class="text-caption-sm text-[--color-mute] w-5">W</span>
            </div>
          </div>

          <!-- Zone (derived) -->
          <div class="flex items-center justify-between py-md" style="border-top:1px solid #ececee;">
            <span class="text-caption-md font-bold text-[--color-ink]">Zone</span>
            <div class="flex items-center">
              {#if powerDerived && zoneLabel}
                <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}%</span>
              {:else if !(ftp > 0)}
                <button class="text-caption-sm flex items-center gap-xxs text-[--color-mute]"
                  on:click={() => { profileOpen = true; rideOpen = false; }}>
                  Set FTP first <ChevronRight class="w-3 h-3" />
                </button>
              {:else}
                <span class="text-caption-sm text-[--color-mute]">Enter power</span>
              {/if}
            </div>
          </div>

          <!-- Temperature -->
          <div class="py-lg" style="border-top:1px solid #ececee;">
            <div class="flex items-center justify-between mb-sm">
              <label for="temperature" class="text-caption-md font-bold text-[--color-ink]">Temperature</label>
              <!-- °C intentional — heat formula is Celsius-based regardless of unit preference -->
              <span class="text-caption-md font-bold text-[--color-ink]">{temperature}°C</span>
            </div>
            <input id="temperature" type="range" bind:value={temperature} min="0" max="45" step="1"
              class="temp-slider w-full"
              style="--fill:{(temperature / 45 * 100).toFixed(1)}%" />
            <p class="text-caption-sm mt-md {heatBonus > 0 ? 'text-[--color-sale]' : 'text-[--color-mute]'}">
              {heatBonus > 0 ? `+${heatBonus.toFixed(1)} L/h heat adjustment` : 'Heat adjustment activates above 20°C'}
            </p>
          </div>

          <!-- Reset -->
          <div class="flex justify-end pt-sm">
            <button class="filter-chip flex items-center gap-xs" on:click={resetInputs}
              on:mousedown={startHold} on:mouseup={cancelHold} on:mouseleave={cancelHold}
              on:touchstart|preventDefault={startHold} on:touchend={cancelHold} on:touchcancel={cancelHold}
              on:contextmenu|preventDefault
              style="touch-action:manipulation;user-select:none;-webkit-user-select:none;"
              aria-label="Reset ride inputs">
              <RotateCcw class="w-4 h-4" />
              Reset ride
            </button>
          </div>

        </div>
      {/if}
    </div>

    </div><!-- /Unified setup card -->

    {#if duration > 0 && (weight > 0)}

    <!-- Results Row 1: Carbs + Fluids (primary output) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg mb-lg card-enter card-enter-3">

      <!-- Carbs card -->
      <div class="p-lg" style="background:#ffffff;border-radius:36px;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.04) 0px 4px 12px 0px;">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:#ececee;border-radius:14px;">
            <Wheat class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Carbohydrates</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for optimal performance</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key carbsPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {carbsPerHour > 0 ? 'num-flash' : ''}" style="color:{carbsPerHour > 0 ? 'var(--color-ink)' : '#d4d4d8'};transition:color 0.3s ease;">{Math.round($animatedCarbs)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">g/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">
          {#if powerDerived}
            From {power}W at {Math.round(intensityFactor * 100)}% FTP
          {:else}
            Estimated from intensity level
          {/if}
        </p>
        {#if multiCarbNote}
          <p class="text-caption-sm text-[--color-mute] mt-sm">Requires glucose+fructose blend (2:1). Single carbs max ~60 g/h.</p>
        {/if}
      </div>

      <!-- Fluids card -->
      <div class="p-lg" style="background:#ffffff;border-radius:36px;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.04) 0px 4px 12px 0px;">
        <div class="flex items-start gap-md mb-lg">
          <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:#ececee;border-radius:14px;">
            <Droplet class="w-7 h-7 text-[--color-ink]" />
          </div>
          <div class="min-w-0">
            <h2 class="text-heading-lg font-bold text-[--color-ink]">Fluids</h2>
            <p class="text-caption-sm text-[--color-mute]">Per hour for hydration</p>
          </div>
        </div>
        <div class="mb-sm">
          <div class="flex items-baseline gap-sm">
            {#key fluidPerHour}
              <span class="text-7xl md:text-8xl font-extra-bold {fluidPerHour > 0 ? 'num-flash' : ''}" style="color:{fluidPerHour > 0 ? 'var(--color-ink)' : '#d4d4d8'};transition:color 0.3s ease;">{$animatedFluid.toFixed(1)}</span>
            {/key}
            <span class="text-3xl text-[--color-mute]">L/h</span>
          </div>
        </div>
        <p class="text-caption-md text-[--color-charcoal]">Based on weight, sweat rate, and duration</p>
        {#if sweatRate !== 'moderate'}
          <p class="text-caption-sm text-[--color-mute] mt-xs">{sweatRate === 'light' ? '−20%' : '+30%'} for {sweatRate} sweater</p>
        {/if}
        {#if heatBonus > 0}
          <p class="text-caption-sm text-[--color-sale] mt-xs">+{heatBonus.toFixed(1)} L/h for {temperature}°C heat</p>
        {/if}
      </div>
    </div>

    <!-- Results Row 2: Power (+ speed when available) -->
    <div class="p-lg mb-lg card-enter card-enter-4" style="background:#ffffff;border-radius:36px;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.04) 0px 4px 12px 0px;">
      <div class="flex items-start gap-md mb-lg">
        <div class="w-12 h-12 flex items-center justify-center flex-shrink-0" style="background:#ececee;border-radius:14px;">
          <Zap class="w-7 h-7 text-[--color-ink]" />
        </div>
        <div class="min-w-0">
          <h2 class="text-heading-lg font-bold text-[--color-ink]">Power</h2>
          <p class="text-caption-sm text-[--color-mute]">Ride intensity based on your FTP</p>
        </div>
      </div>
      <div class="mb-md">
        <div class="flex items-baseline gap-sm">
          <span class="text-7xl md:text-8xl font-extra-bold" style="color:{power > 0 ? 'var(--color-ink)' : '#d4d4d8'};transition:color 0.3s ease;">{power ?? 0}</span>
          <span class="text-3xl text-[--color-mute]">W</span>
        </div>
      </div>
      {#if powerDerived}
        <div class="flex items-center gap-sm flex-wrap">
          <span class="badge-black" style={zoneBadgeStyle}>{zoneLabel} · {Math.round(intensityFactor * 100)}% FTP</span>
          <span class="badge-black" style="background:var(--color-accent);color:#ffffff;">~{Math.round($animatedKcalPerHour)} kcal/h</span>
        </div>
      {:else}
        <p class="text-caption-sm text-[--color-mute]">Enter FTP and ride power to see zone</p>
      {/if}
      {#if speedKmh > 0}
        <div class="flex items-center justify-between mt-md pt-md" style="border-top:1px solid #ececee;">
          <div class="flex items-baseline gap-sm">
            <span class="text-heading-md font-bold text-[--color-ink]">{Math.round($animatedSpeed)}</span>
            <span class="text-caption-md text-[--color-mute]">{speedUnit}</span>
          </div>
          {#if speedSlogan}
            <a href={animalLinks[speedSlogan]} target="_blank" rel="noopener noreferrer">
              <span class="badge-black inline-flex items-center gap-xs">
                {speedSlogan}
                <ExternalLink class="w-3 h-3" />
              </span>
            </a>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Totals + Fueling Schedule + Bottle Planner — tabbed dark card -->
    <div bind:this={tabCard} class="card-campaign rounded-sm p-lg md:p-xl mb-xl card-enter card-enter-5">

      <!-- Tab bar -->
      <div style="display:flex;gap:3px;margin-bottom:18px;background:rgba(255,255,255,0.08);border-radius:20px;padding:3px;">
        <button
          style={tabStyle('summary', totalsTab)}
          on:click={() => switchTab('summary')}>Totals</button>
        <button
          style={tabStyle('schedule', totalsTab)}
          on:click={() => switchTab('schedule')}>Schedule</button>
        <button
          style={tabStyle('pack', totalsTab)}
          on:click={() => switchTab('pack')}>Pack</button>
      </div>

      <!-- Totals tab -->
      {#if totalsTab === 'summary'}
        <div in:fade={{ duration: 250 }}>
        <h2 class="text-caption-md mb-lg text-[--color-on-primary]">Total needs for {formatDuration(duration)}</h2>
        <div class="grid grid-cols-3 gap-md">
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs" style="color:#ffffff;">{Math.round($animatedTotalCarbs)}g</div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">Carbs</div>
          </div>
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs flex items-center justify-center" style="color:#ffffff;min-height:1.2em;">
              {powerDerived ? Math.round($animatedTotalKcal) : '—'}
            </div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">kcal</div>
          </div>
          <div class="rounded-md p-md text-center">
            <div class="text-4xl md:text-5xl font-extra-bold mb-xs" style="color:#ffffff;">{$animatedTotalFluid.toFixed(1)}L</div>
            <div class="text-caption-sm" style="color:rgba(255,255,255,0.70);">Fluids</div>
          </div>
        </div>
        </div>

      <!-- Schedule tab -->
      {:else if totalsTab === 'schedule'}
        <div in:fade={{ duration: 250 }}>
        <!-- Solid product picker -->
        <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
          <span style="color:rgba(255,255,255,0.7);font-size:13px;">Solid food</span>
          <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
            {#each SOLID_PRODUCTS as p}
              <button
                style="{solidProduct === p.id ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;"
                on:click={() => (solidProduct = p.id)}>{p.label} ({p.carbs}g)</button>
            {/each}
          </div>
        </div>
        {#if fuelingEvents.length === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">Ride too short for a fueling schedule.</p>
        {:else if fuelingEvents[0].carbs === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">No solid food needed — drink covers all carbs.</p>
        {:else}
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            {#each fuelingEvents as event, i}
              <div class="flex items-center justify-between px-lg py-md"
                style="{i < fuelingEvents.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.08);' : ''}">
                <span style="color:rgba(255,255,255,0.70);font-size:13px;font-variant-numeric:tabular-nums;min-width:2.6rem;">{event.time}</span>
                <span style="color:#ffffff;font-weight:700;font-size:15px;">{event.carbs}g</span>
                <span style="color:rgba(255,255,255,0.70);font-size:12px;">{event.units}× {solidLabel}</span>
              </div>
            {/each}
          </div>
          <div class="flex items-center justify-between mt-md">
            <p style="color:rgba(255,255,255,0.70);font-size:12px;">First fuel at 20 min · every 20 min after</p>
            <p style="color:rgba(255,255,255,0.70);font-size:12px;font-weight:600;">{totalSolidUnits} {solidLabel}s total</p>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.70);font-size:11px;margin-top:6px;">↑ reduced by {drinkCarbsPerHour}g/h from drink</p>
          {/if}
        {/if}
        </div>

      <!-- Pack tab (bottles + checklist) -->
      {:else if totalsTab === 'pack'}
        <div in:fade={{ duration: 250 }}>
        {#if bottleCount === 0}
          <p style="color:rgba(255,255,255,0.70);font-size:14px;">No bottles needed at this intensity.</p>
        {:else}
          <!-- Drink product picker -->
          <div class="flex items-center justify-between mb-md flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">Drink type</span>
            <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
              {#each DRINK_PRODUCTS as p}
                <button
                  style="{drinkProduct === p.id ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 12px;font-size:12px;font-weight:500;transition:background 0.15s,color 0.15s;white-space:nowrap;"
                  on:click={() => (drinkProduct = p.id)}>{p.label}</button>
              {/each}
            </div>
          </div>
          <!-- Bottle size selector -->
          <div class="flex items-center justify-between mb-lg flex-wrap gap-sm">
            <span style="color:rgba(255,255,255,0.7);font-size:13px;">Bottle size</span>
            <div style="display:flex;border-radius:20px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;background:rgba(255,255,255,0.06);">
              <button style="{bottleSize === 500 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 500)}>500ml</button>
              <button style="{bottleSize === 750 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 750)}>750ml</button>
              <button style="{bottleSize === 1000 ? 'background:rgba(255,255,255,0.9);color:#111;' : 'background:transparent;color:rgba(255,255,255,0.6);'}padding:6px 14px;font-size:13px;font-weight:500;transition:background 0.15s,color 0.15s;" on:click={() => (bottleSize = 1000)}>1L</button>
            </div>
          </div>
          <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Bottles needed</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{bottleCount}</span>
            </div>
            <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Fluid per bottle</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{mlPerBottle} ml</span>
            </div>
            {#if drinkCarbsPerBottle > 0}
              <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid rgba(255,255,255,0.12);">
                <span style="color:rgba(255,255,255,0.6);font-size:14px;">Carbs from drink</span>
                <span style="color:#fff;font-weight:700;font-size:15px;">{drinkCarbsPerBottle} g/bottle</span>
              </div>
            {/if}
            <div class="flex items-center justify-between px-lg py-md">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">Extra solid carbs</span>
              <span style="color:#fff;font-weight:700;font-size:15px;">{Math.max(0, carbsPerBottle)} g/bottle</span>
            </div>
          </div>
          {#if drinkCarbsPerHour > 0}
            <p style="color:rgba(255,255,255,0.70);font-size:11px;margin-top:10px;">Drink covers {drinkCarbsPerHour}g/h → less solid food needed. Check Schedule tab.</p>
          {:else}
            <p style="color:rgba(255,255,255,0.70);font-size:12px;margin-top:10px;">Water only — all carbs from solid food.</p>
          {/if}

          <!-- Pack checklist -->
          {#if packItems.length > 0}
            <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.12);padding-top:16px;">
              <div class="flex items-center justify-between mb-md">
                <span style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Pack list</span>
                {#if checkedPack.size > 0}
                  <button style="color:rgba(255,255,255,0.70);font-size:11px;" on:click={resetPack}>Reset</button>
                {/if}
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                {#each packItems as item}
                  {@const checked = checkedPack.has(item.id)}
                  <button
                    class="flex items-center gap-md text-left"
                    on:click={() => togglePack(item.id)}>
                    <div style="width:22px;height:22px;border-radius:6px;border:1.5px solid {checked ? '#ffffff' : 'rgba(255,255,255,0.25)'};background:{checked ? '#ffffff' : 'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">
                      {#if checked}
                        <Check class="w-3 h-3" style="color:#09090b;" />
                      {/if}
                    </div>
                    <span style="font-size:14px;color:{checked ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)'};text-decoration:{checked ? 'line-through' : 'none'};transition:color 0.15s;">{item.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
        </div>
      {/if}
    </div>

    {:else}
    <!-- Results empty state -->
    <div class="awesomic-card rounded-sm py-md px-lg text-center mb-xl card-enter card-enter-3"
      transition:fade={{ duration: 200 }}>
      <p class="text-caption-md text-[--color-mute]">Enter duration and weight to see results.</p>
    </div>
    {/if}

    <!-- Footer -->
    <div style="border-top:1px solid #ececee;padding-bottom:max(56px, calc(env(safe-area-inset-bottom) + 24px));">
      <div class="flex items-center justify-between flex-wrap gap-xs" style="padding:12px 0;">
        <span class="text-caption-sm" style="color:var(--color-stone);padding:4px 0;">© 2026 Daniel Muschinski</span>
        <div class="flex items-center flex-wrap">
          <button on:click={() => showMathSheet = true}
            class="text-caption-sm text-[--color-mute] hover:text-[--color-ink]"
            style="padding:8px 10px;transition:color 0.15s;">How it works</button>
          <span style="color:var(--color-hairline);user-select:none;">·</span>
          <button on:click={() => showAboutSheet = true}
            class="text-caption-sm text-[--color-mute] hover:text-[--color-ink]"
            style="padding:8px 10px;transition:color 0.15s;">About</button>
          <span style="color:var(--color-hairline);user-select:none;">·</span>
          <button on:click={() => showImpressumSheet = true}
            class="text-caption-sm text-[--color-mute] hover:text-[--color-ink]"
            style="padding:8px 10px;transition:color 0.15s;">Legal</button>
        </div>
      </div>
    </div>

  </div>

  <!-- About sheet -->
  {#if showAboutSheet}
    <div class="fixed inset-0 z-[995] bg-black/40"
      on:click={() => showAboutSheet = false} role="presentation"
      transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[996] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:#ffffff;color:#18181b;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.12) 0px -4px 24px 0px;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showAboutSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 420, duration: 380, easing: cubicOut }}
      out:fly={{ y: 420, duration: 260, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:#d4d4d8;"></div>

      <!-- App identity -->
      <div class="flex items-center gap-md mb-lg">
        <img src="/favicon.svg" alt="" class="w-10 h-10 flex-shrink-0" style="border-radius:18%;" />
        <div>
          <p class="text-heading-md font-extra-bold" style="color:#18181b;">bonkproof</p>
          <p class="text-caption-sm" style="color:#71717a;">v{VERSION}</p>
        </div>
      </div>

      <p class="text-body-md mb-lg" style="color:#52525b;">Precision carbohydrate and fluid targets for cyclists — calculated from your FTP and planned ride power.</p>

      <div style="border-radius:14px;overflow:hidden;border:1px solid #ececee;margin-bottom:24px;">
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid #ececee;">
          <span style="color:#71717a;font-size:14px;">Data storage</span>
          <span style="color:#18181b;font-weight:600;font-size:14px;">Device only</span>
        </div>
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid #ececee;">
          <span style="color:#71717a;font-size:14px;">Server requests</span>
          <span style="color:#18181b;font-weight:600;font-size:14px;">None</span>
        </div>
        <div class="flex items-center justify-between px-lg py-md">
          <span style="color:#71717a;font-size:14px;">Works offline</span>
          <span style="color:#18181b;font-weight:600;font-size:14px;">Yes</span>
        </div>
      </div>

      <div class="flex gap-sm">
        <a href="https://github.com/moindnl" target="_blank" rel="noopener noreferrer"
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold text-center"
          style="background:#09090b;color:#ffffff;text-decoration:none;box-shadow:rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset,rgba(117,123,133,0.4) 0px 9px 14px -5px inset,rgb(44,46,52) 0px 0px 0px 1.5px,rgba(0,0,0,0.14) 0px 4px 6px 0px;">
          GitHub <ExternalLink size={14} style="display:inline;vertical-align:middle;margin-left:4px;" />
        </a>
        <button on:click={() => showAboutSheet = false}
          class="flex-1 py-3 rounded-full text-button-md font-extra-bold"
          style="background:#f4f4f5;color:#3f3f46;border:1px solid #d4d4d8;">
          Close
        </button>
      </div>
    </div>
  {/if}

  <!-- PWA install bottom sheet -->
  {#if installPlatform}
    <div class="fixed inset-0 z-[990] bg-black/40"
      on:click={dismissInstallSheet} role="presentation" transition:fade={{ duration: 200 }}>
    </div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:#ffffff;color:#18181b;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.12) 0px -4px 24px 0px;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={(e) => onSheetDragStart(e, dismissInstallSheet)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 420, duration: 380, easing: cubicOut }}
      out:fly={{ y: 420, duration: 260, easing: cubicIn }}>
      <!-- Drag handle -->
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:#d4d4d8;"></div>

      <div class="mb-4">
        <p class="text-heading-md font-extra-bold" style="color:#18181b;">Works offline</p>
        <p class="text-caption-md mt-1" style="color:#71717a;">Save to home screen for instant access.</p>
      </div>

      {#if installPlatform === 'ios'}
        <ol class="space-y-3 text-body-md">
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">1</span>
            <span>Tap the <strong>Share</strong> button at the bottom of Safari</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">2</span>
            <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge text-xs shrink-0 mt-0.5">3</span>
            <span>Tap <strong>Add</strong> — done</span>
          </li>
        </ol>
        <p class="text-caption-sm mt-4" style="color:#71717a;">Safari only. Chrome and Firefox on iOS cannot install PWAs.</p>
      {:else}
        {#if deferredInstallPrompt}
          <button on:click={triggerInstall}
            class="w-full py-3 rounded-full text-button-md font-extra-bold mb-4"
            style="background:#09090b;color:#ffffff;box-shadow:rgba(255,255,255,0.5) 0px 0.5px 0px 0px inset,rgba(117,123,133,0.4) 0px 9px 14px -5px inset,rgb(44,46,52) 0px 0px 0px 1.5px,rgba(0,0,0,0.14) 0px 4px 6px 0px;">
            Install now
          </button>
        {:else}
          <ol class="space-y-3 text-body-md">
            <li class="flex items-start gap-3">
              <span class="badge text-xs shrink-0 mt-0.5">1</span>
              <span>Tap the <strong>⋮ menu</strong> in Chrome <span style="color:#71717a;">(top-right corner)</span></span>
            </li>
            <li class="flex items-start gap-3">
              <span class="badge text-xs shrink-0 mt-0.5">2</span>
              <span>Tap <strong>Add to Home screen</strong> → <strong>Add</strong></span>
            </li>
          </ol>
          <p class="text-caption-sm mt-4" style="color:#71717a;">Chrome may also show an install banner at the bottom automatically.</p>
        {/if}
      {/if}

      <button on:click={dismissInstallSheet}
        class="mt-6 w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:#f4f4f5;color:#3f3f46;border:1px solid #d4d4d8;">
        Not now
      </button>
    </div>
  {/if}

  <!-- Easter egg F: neuralyzer flash -->
  {#if neuralizer}
    <div class="fixed inset-0 z-[999] flex flex-col items-center justify-center"
      style="background:rgba(0,0,0,0.88);animation:neuralizer-flash 2.9s ease forwards;">
      <p style="font-size:clamp(14px,3vw,18px);font-weight:700;color:#ffffff;text-align:center;max-width:420px;padding:0 24px;line-height:1.6;opacity:0;animation:neuralizer-text 2.9s ease forwards;">
        Hm? There was no ride. You've been watching Netflix. Have a nice day.
      </p>
    </div>
  {/if}

  <!-- Impressum sheet -->
  {#if showImpressumSheet}
    <div class="fixed inset-0 z-[990] bg-black/40"
      on:click={() => showImpressumSheet = false} role="presentation"
      transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:#ffffff;color:#18181b;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.12) 0px -4px 24px 0px;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showImpressumSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 420, duration: 380, easing: cubicOut }}
      out:fly={{ y: 420, duration: 260, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:#d4d4d8;"></div>
      <p class="text-heading-md font-extra-bold mb-lg" style="color:#18181b;">Impressum</p>

      <p class="text-caption-sm mb-xs" style="color:#71717a;">Legal disclosure · § 5 TMG</p>
      <div style="border-radius:14px;overflow:hidden;border:1px solid #ececee;margin-bottom:20px;">
        <div class="px-lg py-md" style="border-bottom:1px solid #ececee;">
          <p style="color:#18181b;font-size:14px;font-weight:600;">Daniel Muschinski</p>
          <p style="color:#71717a;font-size:13px;margin-top:2px;">Freudenbegrstraße 4, 28213 Bremen</p>
        </div>
        <div class="flex items-center justify-between px-lg py-md" style="border-bottom:1px solid #ececee;">
          <span style="color:#71717a;font-size:14px;">Contact</span>
          <a href="https://github.com/moindnl" target="_blank" rel="noopener noreferrer"
            style="color:#18181b;font-size:14px;font-weight:600;text-decoration:none;">github.com/moindnl</a>
        </div>
        <div class="px-lg py-md">
          <p style="color:#71717a;font-size:13px;line-height:1.5;">Private, non-commercial project. No personal data is collected or shared with third parties.</p>
        </div>
      </div>

      <button on:click={() => showImpressumSheet = false}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:#f4f4f5;color:#3f3f46;border:1px solid #d4d4d8;">
        Close
      </button>
    </div>
  {/if}

  <!-- Math sheet -->
  {#if showMathSheet}
    <div class="fixed inset-0 z-[990] bg-black/40"
      on:click={() => showMathSheet = false} role="presentation"
      transition:fade={{ duration: 200 }}></div>
    <div class="fixed bottom-0 left-0 right-0 z-[991] rounded-t-[28px] px-6 pt-5 pb-8 max-w-lg mx-auto"
      style="background:#ffffff;color:#18181b;box-shadow:rgb(228,228,231) 0px 1px 0px 0px inset,rgba(0,0,0,0.12) 0px -4px 24px 0px;transform:translateY({sheetDragOffsetY}px);transition:{sheetIsDragging ? 'none' : 'transform 0.25s ease'};"
      on:touchstart={(e) => onSheetDragStart(e, () => showMathSheet = false)}
      on:touchmove|preventDefault={onSheetDragMove}
      on:touchend={onSheetDragEnd}
      in:fly={{ y: 420, duration: 380, easing: cubicOut }}
      out:fly={{ y: 420, duration: 260, easing: cubicIn }}>
      <div class="w-10 h-1 rounded-full mx-auto mb-5" style="background:#d4d4d8;"></div>
      <p class="text-heading-md font-extra-bold mb-lg" style="color:#18181b;">How the math works</p>

      <div class="mb-lg" style="border-radius:14px;overflow:hidden;border:1px solid #ececee;">
        <div class="grid text-caption-sm font-extra-bold uppercase" style="grid-template-columns:1fr auto auto;background:#f4f4f5;padding:8px 14px;color:#71717a;letter-spacing:0.05em;">
          <span>Zone</span><span class="text-right pr-4">% FTP</span><span class="text-right">Carbs</span>
        </div>
        {#each [
          { zone: 'Recovery',  ftp: '<55%',    carbs: '0–20 g/h' },
          { zone: 'Endurance', ftp: '55–75%',  carbs: '20–40 g/h' },
          { zone: 'Tempo',     ftp: '75–90%',  carbs: '40–60 g/h' },
          { zone: 'Threshold', ftp: '90–105%', carbs: '60–90 g/h' },
          { zone: 'VO₂max+',   ftp: '>105%',   carbs: '90–120 g/h' },
        ] as row, i}
          <div class="grid text-caption-sm" style="grid-template-columns:1fr auto auto;padding:10px 14px;{i % 2 === 1 ? 'background:#f4f4f5;' : ''}border-top:1px solid #ececee;">
            <span style="color:#18181b;">{row.zone}</span>
            <span class="text-right pr-4" style="color:#71717a;">{row.ftp}</span>
            <span class="text-right" style="color:#52525b;">{row.carbs}</span>
          </div>
        {/each}
      </div>

      <p class="text-caption-sm mb-sm" style="color:#71717a;">Fluids scale with body weight — sweat modifier adjusts ±20–30%.</p>
      <p class="text-caption-sm mb-sm" style="color:#71717a;">Heat: +0.3 L/h per 5°C above 20°C added to fluid target.</p>
      <p class="text-caption-sm mb-lg" style="color:#71717a;">Rides &gt;2h: add electrolytes — plain water dilutes sodium balance on long efforts.</p>

      <button on:click={() => showMathSheet = false}
        class="w-full py-3 rounded-full text-button-md font-extra-bold"
        style="background:#f4f4f5;color:#3f3f46;border:1px solid #d4d4d8;">
        Close
      </button>
    </div>
  {/if}
</main>
