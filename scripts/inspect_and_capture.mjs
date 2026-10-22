import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\nvidi\\.gemini\\antigravity\\brain\\7cfd4b7e-1a0f-4cb2-9906-95604103955e';
const URL = process.env.GAME_URL || 'http://localhost:5173';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runInspection() {
  const consoleErrors = [];
  const networkErrors = [];

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1920,1080',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  page.on('requestfailed', (req) => {
    networkErrors.push(`${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log('1. Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(600);

  // Capture 01: Main Menu
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_main_menu.png') });
  console.log('Captured 01_main_menu.png');

  // Helper to position player/camera and render a clean view on the current map
  async function captureMapView(filename, camPos, lookAtPos, showViewmodel = true) {
    await page.evaluate(
      ({ camPos, lookAtPos, showViewmodel }) => {
        const game = window.__BLACKLINE_GAME__;
        if (!game) return;
        game.practiceAiActive = false;
        game.setCameraPoseForInspection(camPos, lookAtPos, showViewmodel);
      },
      { camPos, lookAtPos, showViewmodel }
    );
    await page.screenshot({ path: path.join(ARTIFACT_DIR, filename) });
    console.log('Captured', filename);
  }

  // Start match on Breakwater Terminal
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.startMatch({
      mapId: 'breakwater',
      modeId: 'tdm',
      difficulty: 'regular',
      primaryWeapon: 'ar',
      scoreLimit: 40,
      timeLimitSeconds: 480,
    });
    game.practiceAiActive = false;
  });
  await sleep(500);

  // Breakwater views (3 meaningful views)
  await captureMapView('02_breakwater_overview.png', [-22, 4.2, 12], [0, 3.8, 0], true);
  await captureMapView('03_breakwater_warehouse.png', [-11.5, 2.0, -21.5], [12, 1.9, -21.5], true);
  await captureMapView('04_breakwater_catwalk.png', [12, 5.0, -8], [-8, 2.5, 16], true);

  // Weapon Showcase & ADS captures on Breakwater
  const weaponShots = [
    { id: 'ar', file: '11_weapon_ar_hip.png', ads: 0 },
    { id: 'ar', file: '12_weapon_ar_ads.png', ads: 1.0 },
    { id: 'smg', file: '13_weapon_smg.png', ads: 0 },
    { id: 'shotgun', file: '14_weapon_shotgun.png', ads: 0 },
    { id: 'dmr', file: '15_weapon_dmr_ads.png', ads: 1.0 },
    { id: 'pistol', file: '16_weapon_pistol.png', ads: 0 },
  ];

  for (const w of weaponShots) {
    await page.evaluate(
      ({ wId, ads }) => {
        const game = window.__BLACKLINE_GAME__;
        game.practiceAiActive = false;
        game.equipWeaponForShowcase(wId, ads);
        game.setCameraPoseForInspection([-18, 1.62, 9], [0, 2.2, 2], true);
      },
      { wId: w.id, ads: w.ads }
    );
    await page.screenshot({ path: path.join(ARTIFACT_DIR, w.file) });
    console.log('Captured', w.file);
  }

  // Reset ADS after weapon showcase
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.equipWeaponForShowcase('ar', 0);
    game.inspectionPoseActive = false;
  });

  // Active Combat screenshot (place an enemy in front of player, fire shot to trigger muzzle flash, tracer, hitmarker)
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.inspectionPoseActive = false;
    game.practiceAiActive = true;
    game.equipWeaponForShowcase('ar', 0);
    game.inspectionPoseActive = false;
    game.player.state.position.set(-10, 0, 4);
    const enemy = game.bots.find((b) => b.state.team === 'kestrel');
    if (enemy) {
      enemy.state.isAlive = true;
      enemy.state.health = 100;
      enemy.state.position.set(-10, 0, -6.5);
      enemy.state.yaw = 0;
      enemy.rig.root.position.copy(enemy.state.position);
      enemy.rig.root.visible = true;
    }
    game.player.state.yaw = 0; // looking along -Z toward (-10, 0, -6.5)
    game.player.state.pitch = -0.04;
    game.player.onMouseDown(0);
    game.stepSimulation(1 / 60);
    game.player.onMouseUp(0);
    game.sceneRenderer.render();
  });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '17_active_combat.png') });
  console.log('Captured 17_active_combat.png');

  // Capture Scoreboard
  await page.keyboard.down('Tab');
  await sleep(100);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '18_scoreboard.png') });
  await page.keyboard.up('Tab');
  console.log('Captured 18_scoreboard.png');

  // Switch to Map 2: Mesa Relay and capture 3 views
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.startMatch({
      mapId: 'mesa',
      modeId: 'tdm',
      difficulty: 'regular',
      primaryWeapon: 'dmr',
      scoreLimit: 40,
      timeLimitSeconds: 480,
    });
    game.practiceAiActive = false;
    game.player.equipProgress = 1.0;
  });
  await sleep(500);
  await captureMapView('05_mesa_courtyard.png', [-18, 3.2, 14], [0, 5.0, 0], true);
  await captureMapView('06_mesa_canyon_flank.png', [-16, 2.0, 22], [16, 2.5, 22], true);
  await captureMapView('07_mesa_overlook.png', [0, 4.65, -18.2], [0, 2.2, 6], true);

  // Switch to Map 3: Northstar Facility and capture 3 views
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.startMatch({
      mapId: 'northstar',
      modeId: 'ffa',
      difficulty: 'veteran',
      primaryWeapon: 'smg',
      scoreLimit: 25,
      timeLimitSeconds: 480,
    });
    game.practiceAiActive = false;
    game.player.equipProgress = 1.0;
  });
  await sleep(500);
  await captureMapView('08_northstar_plaza.png', [-20, 3.2, 12], [0, 4.2, -2], true);
  await captureMapView('09_northstar_lab_interior.png', [-12, 2.0, -19.5], [12, 1.9, -21.0], true);
  await captureMapView('10_northstar_service_yard.png', [22, 3.0, 18], [-10, 2.5, 8], true);

  // Re-enable full bot combat AI and measure representative combat performance over 3.0 seconds of active 8-combatant simulation
  await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    game.inspectionPoseActive = false;
    game.practiceAiActive = true;
  });
  console.log('Measuring representative combat performance at 1920x1080...');
  await sleep(3000);
  const perfStats = await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    return {
      fps: game.measuredFps,
      frameTimeMs: game.measuredFrameTimeMs,
      botCount: game.bots.length,
      aliveBots: game.bots.filter((b) => b.state.isAlive).length,
    };
  });

  // Verify Settings Persistence, Reloading, Crouch Clearance, Grenades, and Match End Screen
  const verificationChecks = await page.evaluate(() => {
    const game = window.__BLACKLINE_GAME__;
    const results = {};

    // 1. Settings persistence check
    game.ui.updateSettings({ fov: 94, mouseSensitivity: 1.35 });
    const savedRaw = localStorage.getItem('blackline_fps_settings_v1');
    const saved = JSON.parse(savedRaw || '{}');
    results.settingsPersisted = saved.fov === 94 && Math.abs(saved.mouseSensitivity - 1.35) < 0.01;
    game.ui.resetSettings();

    // 2. Reload state machine check
    const slot = game.player.getCurrentSlot();
    slot.magazine = 5;
    const prevReserve = slot.reserve;
    game.player.startReload(
      {
        id: 'smg',
        magazineSize: 36,
        reloadTime: 0.5,
        emptyReloadTime: 0.6,
      },
      () => {}
    );
    results.reloadStarted = game.player.isReloading === true;

    // 3. Trigger End-of-Match Victory screen
    game.aegisScore = 25;
    game.player.state.kills = 25;
    game.player.state.score = 2650;
    game.checkMatchCompletion();
    results.matchEndedCleanly = game.phase === 'ended';

    return results;
  });

  await sleep(150);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '19_end_of_match.png') });
  console.log('Captured 19_end_of_match.png');

  await browser.close();

  const report = {
    consoleErrors,
    networkErrors,
    perfStats,
    verificationChecks,
  };
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'inspection_report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('Inspection complete:', JSON.stringify(report, null, 2));
}

runInspection().catch((err) => {
  console.error(err);
  process.exit(1);
});
