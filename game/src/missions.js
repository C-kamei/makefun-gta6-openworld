// missions.js — five story missions for Mara Voss, ex-courier of Port Aurelia.
// Every objective marker sits on a road intersection (open ground), so the
// player can always stand inside the objective radius.
// rewritten in-session 2026-11-18 for gta6-01 round 2 resubmission
var AU_MISSIONS = (function () {
  var L = AU_CITY.LANDMARKS;

  function rival(S, x, y, role) {
    return { x: x, y: y, hp: role === 'boss' ? 220 : 70, angle: 0,
      cool: 1 + Math.random(), role: role || 'rival' };
  }

  var MISSIONS = [
    { id: 1, title: 'The Courier\u2019s Debt', giver: 'Rook',
      brief: 'Pick up the package at the Docks. Walk or drive — just get there.',
      say: ['ROOK: Mara, you owe me one run. Package is waiting at the Docks.',
            'MARA: One run. Then we\u2019re square, Rook.'],
      target: function () { return { x: L.docks.x, y: L.docks.y, label: 'DOCKS PICKUP', r: 80 }; },
      start: function (S) {},
      update: function (S, dt) {
        if (dist(S, L.docks) < 80) return complete(S, 150, 'Package secured. Rook is pleased.');
        return null;
      } },
    { id: 2, title: 'Hot Wheels', giver: 'Rook',
      brief: 'Steal a car (E) and bring it to Rook\u2019s Garage. The cops will notice.',
      say: ['ROOK: I need wheels, Mara. Any wheels. Borrow one. Permanently.',
            'MARA: Borrowing. Right. Try not to get shot at.'],
      target: function () { return { x: L.garage.x, y: L.garage.y, label: 'ROOK\u2019S GARAGE', r: 90 }; },
      start: function (S) {},
      update: function (S, dt) {
        if (S.player.inCar && dist(S, L.garage) < 90)
          return complete(S, 300, 'Clean getaway. The garage crew cheers.');
        return null;
      } },
    { id: 3, title: 'Plaza Showdown', giver: 'Vex',
      brief: 'Vex\u2019s crew owns Meridian Plaza. Take all three of them down. Click to shoot.',
      say: ['VEX: This plaza is mine, courier. Walk away or get carried away.',
            'MARA: I\u2019m done walking away.'],
      target: function () { return { x: L.plaza.x, y: L.plaza.y, label: 'MERIDIAN PLAZA', r: 90 }; },
      start: function (S) {
        S.enemies.push(rival(S, L.plaza.x - 60, L.plaza.y - 40));
        S.enemies.push(rival(S, L.plaza.x + 70, L.plaza.y - 30));
        S.enemies.push(rival(S, L.plaza.x + 10, L.plaza.y + 70));
      },
      update: function (S, dt) {
        if (S.enemies.length === 0)
          return complete(S, 500, 'Plaza is yours. Vex\u2019s crew scatters.');
        return null;
      } },
    { id: 4, title: 'The Bank Job', giver: 'Rook',
      brief: 'Grab the cash at Aurelia Bank, then lose the heat at the Hideout.',
      say: ['ROOK: The bank vault clerk owes me. Grab the bag, then vanish.',
            'MARA: And the three stars of heat? That\u2019s the fun part.'],
      target: function (S) {
        return S.missionStage === 0
          ? { x: L.bank.x, y: L.bank.y, label: 'AURELIA BANK', r: 80 }
          : { x: L.hideout.x, y: L.hideout.y, label: 'HIDEOUT', r: 80 };
      },
      start: function (S) {},
      update: function (S, dt) {
        if (S.missionStage === 0 && dist(S, L.bank) < 80) {
          S.missionStage = 1;
          AU_ENT.addWanted(S, 3, 'Bank alarm tripped');
          S.toast('Cash grabbed — get to the Hideout!', '#ffd24a');
          AU_AUDIO.pickup();
          return null;
        }
        if (S.missionStage === 1 && dist(S, L.hideout) < 80)
          return complete(S, 900, 'Clean. The heat never found the Hideout.');
        return null;
      } },
    { id: 5, title: 'King of the Marina', giver: 'Mara',
      brief: 'Vex himself waits at the Marina with four guards. End this.',
      say: ['VEX: You took my plaza, my bank. But the Marina is mine, courier.',
            'MARA: Then the Marina is where this ends.'],
      target: function () { return { x: L.marina.x, y: L.marina.y, label: 'MARINA', r: 100 }; },
      start: function (S) {
        // All spawns sit ON roads (x=2800 vertical, y=2000 horizontal), and
        // every sightline from the northern approach runs along a road, so
        // the Marina building corner can never block a shot.
        S.enemies.push(rival(S, L.marina.x, L.marina.y - 100, 'guard'));
        S.enemies.push(rival(S, L.marina.x, L.marina.y + 100, 'guard'));
        S.enemies.push(rival(S, L.marina.x + 100, L.marina.y, 'guard'));
        S.enemies.push(rival(S, L.marina.x, L.marina.y + 200, 'guard'));
        S.enemies.push(rival(S, L.marina.x, L.marina.y, 'boss'));
      },
      update: function (S, dt) {
        if (S.enemies.length === 0) {
          S.cash += 2000;
          return 'won';
        }
        return null;
      } }
  ];

  function dist(S, pt) { return Math.hypot(S.player.x - pt.x, S.player.y - pt.y); }

  function complete(S, cash, msg) {
    S.cash += cash;
    S.toast(msg + '  +$' + cash, '#7dd93d');
    AU_AUDIO.missionDone();
    return 'next';
  }

  function startMission(S, i) {
    S.missionIndex = i;
    S.missionStage = 0;
    S.enemies.length = 0;
    var m = MISSIONS[i];
    if (m) {
      m.start(S);
      S.say(m.say);
      S.toast('MISSION ' + m.id + ': ' + m.title, '#ffd24a');
    }
  }

  function current(S) { return MISSIONS[S.missionIndex] || null; }

  function updateMission(S, dt) {
    var m = current(S);
    if (!m) return;
    var r = m.update(S, dt);
    if (r === 'next') {
      if (S.missionIndex + 1 < MISSIONS.length) startMission(S, S.missionIndex + 1);
      else { S.state = 'won'; }
    } else if (r === 'won') {
      S.state = 'won';
      AU_AUDIO.missionDone();
    }
  }

  return { MISSIONS: MISSIONS, startMission: startMission, current: current,
    updateMission: updateMission };
})();
