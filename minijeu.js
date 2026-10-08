/* ============================================================
   ASTRA-9 : DERNIER OXYGÈNE
   Mini-jeux du livre
   ------------------------------------------------------------
   - Secteur 02 : Simon / reproduction de séquence
   - Secteur 06 : stabilisation du réacteur par clic rapide
   Le script ne fait RIEN si aucune balise correspondante n'est présente.
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('mg');
  var reactorRoot = document.getElementById('reacteur-game');

  if (root) {
    /* ---------- Configuration ---------- */
    var NEXT_PAGE = 'page03-secteur-medical.html#page3';
    var MAX_LEVEL = 3;
    var MAX_LIVES = 3;
    var WIN_DELAY = 6;
    var seqLen = function (lvl) { return lvl + 2; };
    var stepMs = function (lvl) { return Math.max(340, 620 - lvl * 80); };

    var elLevel = document.getElementById('mgLevel');
    var elLives = document.getElementById('mgLives');
    var elBest = document.getElementById('mgBest');
    var elMsg = document.getElementById('mgMsg');
    var btnStart = document.getElementById('mgStart');
    var btnRetry = document.getElementById('mgRetry');
    var btnNext = document.getElementById('mgNext');
    var pads = Array.prototype.slice.call(root.querySelectorAll('.mg-pad'));

    if (!elLevel || !elLives || !elMsg || !btnStart || pads.length !== 4) return;

    var state = 'idle';
    var level = 1;
    var lives = MAX_LIVES;
    var sequence = [];
    var inputIndex = 0;
    var runToken = 0;
    var best = 0;
    var autoTimer = null;

    try { best = parseInt(localStorage.getItem('astra9-mini-jeu-best') || '0', 10) || 0; } catch (e) {}

    var ctx = null;
    function audioCtx() {
      if (ctx) return ctx;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch (e) { ctx = null; }
      return ctx;
    }
    function beep(freq, dur, type, vol, when) {
      var ac = audioCtx();
      if (!ac) return;
      try {
        var t = ac.currentTime + (when || 0);
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + dur + 0.05);
      } catch (e) {}
    }
    var FREQ = [523.25, 659.25, 783.99, 1046.50];
    function padSound(i) { beep(FREQ[i], 0.28, 'square', 0.07); }
    function errorSound() { beep(160, 0.35, 'sawtooth', 0.09); beep(110, 0.45, 'sawtooth', 0.09, 0.12); }
    function okSound() { beep(660, .12, 'square', .06); beep(880, .12, 'square', .06, .1); beep(1320, .22, 'square', .06, .2); }
    function winSound() { [523, 659, 784, 1047, 1319].forEach(function (f, k) { beep(f, .18, 'triangle', .08, k * .11); }); }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function setMsg(t) { if (elMsg) elMsg.textContent = t; }
    function saveBest() { try { localStorage.setItem('astra9-mini-jeu-best', String(best)); } catch (e) {} }

    function render() {
      elLevel.textContent = level;
      elLives.textContent = '●'.repeat(lives) + '○'.repeat(MAX_LIVES - lives);
      elBest.textContent = best > 0 ? best : '—';
    }
    function setPadsEnabled(on) {
      pads.forEach(function (p) { p.disabled = !on; });
    }
    function flash(pad, cls, ms) {
      pad.classList.add(cls);
      return sleep(ms).then(function () { pad.classList.remove(cls); });
    }

    function newSequence() {
      sequence = [];
      for (var i = 0; i < seqLen(level); i++) {
        sequence.push(Math.floor(Math.random() * 4));
      }
    }

    function playSequence(token) {
      state = 'show';
      setPadsEnabled(false);
      setMsg('S.O.L.I. diffuse la séquence… observe bien.');
      var step = stepMs(level);
      return sleep(700).then(function loop() {
        if (token !== runToken) return Promise.resolve();
        var k = 0;
        var chain = Promise.resolve();
        for (k = 0; k < sequence.length; k++) {
          (function (idx) {
            chain = chain.then(function () {
              if (token !== runToken) return Promise.resolve();
              padSound(sequence[idx]);
              return flash(pads[sequence[idx]], 'is-on', Math.round(step * 0.55))
                .then(function () { return sleep(Math.round(step * 0.45)); });
            });
          })(k);
        }
        return chain.then(function () {
          if (token !== runToken) return;
          inputIndex = 0;
          state = 'input';
          setPadsEnabled(true);
          setMsg('À toi ! Reproduis la séquence de ' + sequence.length +
            ' pad' + (sequence.length > 1 ? 's' : '') +
            ' (clic, ou touches 1-4 / A-Z-E-R).');
        });
      });
    }

    function pressPad(i) {
      if (state !== 'input') return;
      padSound(i);
      flash(pads[i], 'is-on', 220);
      if (i === sequence[inputIndex]) {
        inputIndex++;
        if (inputIndex >= sequence.length) levelComplete();
      } else {
        mistake(i);
      }
    }

    function mistake(i) {
      state = 'show';
      setPadsEnabled(false);
      lives--;
      render();
      errorSound();
      flash(pads[i], 'is-ko', 450).then(function () {
        if (lives > 0) {
          setMsg('Mauvais pad ! Plus que ' + lives + ' erreur' + (lives > 1 ? 's' : '') +
            ' autorisée' + (lives > 1 ? 's' : '') + '. La séquence se rejoue…');
        } else {
          setMsg('Panneau verrouillé par S.O.L.I. !');
        }
      });
      if (lives <= 0) { gameOver(); return; }
      var token = runToken;
      sleep(900).then(function () {
        if (token !== runToken) return;
        playSequence(token);
      });
    }

    function levelComplete() {
      state = 'show';
      setPadsEnabled(false);
      okSound();
      if (level > best) { best = level; saveBest(); }
      render();
      if (level >= MAX_LEVEL) { win(); return; }
      setMsg('Niveau ' + level + ' validé ! La séquence s’allonge…');
      var token = runToken;
      sleep(1100).then(function () {
        if (token !== runToken) return;
        level++;
        render();
        newSequence();
        playSequence(token);
      });
    }

    function gameOver() {
      state = 'over';
      setPadsEnabled(false);
      pads.forEach(function (p) { p.classList.add('is-ko'); });
      setMsg('S.O.L.I. a verrouillé le panneau. Relance pour réessayer.');
      btnStart.hidden = true;
      btnNext.hidden = true;
      btnRetry.hidden = false;
    }

    function win() {
      state = 'win';
      setPadsEnabled(false);
      winSound();
      if (level > best) { best = level; saveBest(); }
      render();
      pads.forEach(function (p) { p.classList.add('is-win'); });
      btnStart.hidden = true;
      btnRetry.hidden = true;
      btnNext.hidden = false;
      var left = WIN_DELAY;
      setMsg('✔ Séquence validée ! La porte du secteur médical s’ouvre…');
      autoTimer = setInterval(function () {
        left--;
        if (left <= 0) {
          clearInterval(autoTimer); autoTimer = null;
          setMsg('✔ Accès autorisé — direction le secteur médical !');
          window.location.href = NEXT_PAGE;
        } else {
          setMsg('✔ Séquence validée ! Porte ouverte — départ dans ' + left + ' s… (bouton pour y aller tout de suite)');
        }
      }, 1000);
    }

    function startGame() {
      runToken++;
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      level = 1;
      lives = MAX_LIVES;
      inputIndex = 0;
      pads.forEach(function (p) { p.classList.remove('is-win', 'is-ko'); });
      btnStart.hidden = false;
      btnRetry.hidden = true;
      btnNext.hidden = true;
      render();
      newSequence();
      playSequence(runToken);
    }

    pads.forEach(function (pad, i) {
      pad.addEventListener('click', function () { pressPad(i); });
    });
    btnStart.addEventListener('click', function () {
      if (state === 'show' || state === 'input') return;
      startGame();
    });
    btnRetry.addEventListener('click', startGame);
    btnNext.addEventListener('click', function () {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      window.location.href = NEXT_PAGE;
    });

    var KEYMAP = { '1': 0, 'a': 0, 'z': 1, '2': 1, 'e': 2, '3': 2, 'r': 3, '4': 3 };
    document.addEventListener('keydown', function (ev) {
      if (state !== 'input') return;
      var k = (ev.key || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(KEYMAP, k)) pressPad(KEYMAP[k]);
    });

    setPadsEnabled(false);
    render();
  }

  if (reactorRoot) {
    var zone = reactorRoot.querySelector('.reacteur-zone');
    var target = reactorRoot.querySelector('.reacteur-target');
    var startBtn = reactorRoot.querySelector('.reacteur-start');
    var msg = reactorRoot.querySelector('.reacteur-msg');
    var timerEl = reactorRoot.querySelector('.reacteur-temps');
    var scoreEl = reactorRoot.querySelector('.reacteur-score');

    var goal = 10;
    var timeLeft = 30;
    var score = 0;
    var active = false;
    var timerLoop = null;
    var moverLoop = null;

    function setReacteurMsg(text) {
      if (msg) msg.textContent = text;
    }
    function updateHud() {
      if (timerEl) timerEl.textContent = timeLeft + 's';
      if (scoreEl) scoreEl.textContent = score + '/' + goal;
    }
    function moveTarget() {
      if (!zone || !target || !active) return;
      var leftPercent = 10 + Math.random() * 80;
      var topPercent = 18 + Math.random() * 64;
      target.style.left = leftPercent + '%';
      target.style.top = topPercent + '%';
      target.style.transform = 'translate(-50%, -50%)';
    }
    function failReactorGame() {
      active = false;
      clearInterval(timerLoop);
      clearInterval(moverLoop);
      if (target) {
        target.style.opacity = '0';
        target.hidden = true;
      }
      setReacteurMsg('Le cœur plasma explose. La passerelle est perdue.');
      setTimeout(function () {
        window.location.href = 'page07-fin-brulure-plasma.html#page7';
      }, 1200);
    }
    function winReactorGame() {
      active = false;
      clearInterval(timerLoop);
      clearInterval(moverLoop);
      if (target) target.hidden = true;
      setReacteurMsg('Réacteur stabilisé ! La passerelle est sûre, tu peux traverser.');
      setTimeout(function () {
        window.location.href = 'page08-serre-botanique.html#page8';
      }, 1200);
    }
    function startReactorGame() {
      score = 0;
      timeLeft = 30;
      active = true;
      updateHud();
      if (target) {
        target.hidden = false;
        target.style.opacity = '1';
        moveTarget();
      }
      setReacteurMsg('Le cœur plasma est instable. Clique sur le noyau lumineux avant la fin du compte à rebours.');
      clearInterval(timerLoop);
      clearInterval(moverLoop);
      moverLoop = setInterval(function () {
        if (!active) return;
        moveTarget();
      }, 1000);
      timerLoop = setInterval(function () {
        if (!active) return;
        timeLeft -= 1;
        updateHud();
        if (timeLeft <= 0) {
          failReactorGame();
        }
      }, 1000);
    }

    if (startBtn) {
      startBtn.addEventListener('click', startReactorGame);
    }
    if (target) {
      target.addEventListener('click', function () {
        if (!active) return;
        score += 1;
        updateHud();
        if (score >= goal) {
          winReactorGame();
          return;
        }
        moveTarget();
        setReacteurMsg('Bonne correction. Il reste ' + (goal - score) + ' noyaux à stabiliser.');
      });
    }

    if (target) target.hidden = true;
    updateHud();
    setReacteurMsg('Le cœur plasma vibre. Lance la stabilisation pour sécuriser la passerelle.');
  }

  if (document.getElementById('laboratoire-game')) {
    var laboRoot = document.getElementById('laboratoire-game');
    var laboNodes = Array.prototype.slice.call(laboRoot.querySelectorAll('.labo-node'));
    var laboStart = laboRoot.querySelector('.labo-start');
    var laboMsg = laboRoot.querySelector('.mini-game-msg');
    var laboTimer = laboRoot.querySelector('.mini-game-timer');
    var laboScore = laboRoot.querySelector('.mini-game-score');
    var laboActive = false;
    var laboTimerLoop = null;
    var laboTime = 14;
    var laboScoreValue = 0;
    var laboGoal = 12;
    var laboTargetIndex = null;
    var laboTargetTimeout = null;

    function updateLaboHud() {
      if (laboTimer) laboTimer.textContent = laboTime + 's';
      if (laboScore) laboScore.textContent = laboScoreValue + '/' + laboGoal;
    }

    function resetLaboNodes() {
      laboNodes.forEach(function (node) {
        node.disabled = false;
        node.classList.remove('safe', 'virus');
        node.textContent = '•';
      });
    }

    function failLaboGame() {
      laboActive = false;
      clearInterval(laboTimerLoop);
      clearTimeout(laboTargetTimeout);
      laboNodes.forEach(function (node) {
        node.disabled = true;
        if (laboTargetIndex !== null && Number(node.dataset.index) === laboTargetIndex) {
          node.classList.add('safe');
        } else {
          node.classList.add('virus');
        }
      });
      if (laboMsg) laboMsg.textContent = 'Le virus a pris le contrôle. La fusion mentale commence.';
      setTimeout(function () {
        window.location.href = 'page11-fin-assimilation.html#page11';
      }, 1200);
    }

    function winLaboGame() {
      laboActive = false;
      clearInterval(laboTimerLoop);
      clearTimeout(laboTargetTimeout);
      laboNodes.forEach(function (node) {
        node.disabled = true;
        node.classList.add('safe');
      });
      if (laboMsg) laboMsg.textContent = 'Le cœur de S.O.L.I. est neutralisé. Tu as les codes.';
      setTimeout(function () {
        window.location.href = 'page12-centre-de-donnees.html#page12';
      }, 1200);
    }

    function spawnLaboTarget() {
      if (!laboActive) return;
      resetLaboNodes();
      laboTargetIndex = Math.floor(Math.random() * laboNodes.length);
      var node = laboNodes[laboTargetIndex];
      if (node) {
        node.classList.add('safe');
        node.textContent = 'OK';
      }
      clearTimeout(laboTargetTimeout);
      laboTargetTimeout = setTimeout(function () {
        if (!laboActive) return;
        if (node) {
          node.classList.remove('safe');
          node.textContent = '•';
        }
        laboScoreValue = Math.max(0, laboScoreValue - 1);
        updateLaboHud();
        if (laboMsg) laboMsg.textContent = 'Tu as raté le bon nœud. Il devient plus agressif.';
        spawnLaboTarget();
      }, 700);
    }

    function startLaboGame() {
      laboActive = true;
      laboTime = 14;
      laboScoreValue = 0;
      laboTargetIndex = null;
      clearTimeout(laboTargetTimeout);
      resetLaboNodes();
      updateLaboHud();
      if (laboMsg) laboMsg.textContent = 'Le virus pulse. Clique sur le bon nœud avant qu’il ne se déplace.';
      spawnLaboTarget();
      clearInterval(laboTimerLoop);
      laboTimerLoop = setInterval(function () {
        if (!laboActive) return;
        laboTime -= 1;
        updateLaboHud();
        if (laboTime <= 0) {
          failLaboGame();
        }
      }, 1000);
    }

    if (laboStart) laboStart.addEventListener('click', startLaboGame);
    laboNodes.forEach(function (node) {
      node.addEventListener('click', function () {
        if (!laboActive) return;
        var idx = Number(node.dataset.index);
        if (idx === laboTargetIndex) {
          laboScoreValue += 1;
          updateLaboHud();
          node.classList.remove('safe');
          node.textContent = '•';
          if (laboScoreValue >= laboGoal) {
            winLaboGame();
            return;
          }
          if (laboMsg) laboMsg.textContent = 'Bonne coupure. Il reste ' + (laboGoal - laboScoreValue) + ' cibles.';
          spawnLaboTarget();
        } else {
          failLaboGame();
        }
      });
    });

    resetLaboNodes();
    updateLaboHud();
  }

  if (document.getElementById('laser-game')) {
    var laserRoot = document.getElementById('laser-game');
    var laserStart = laserRoot.querySelector('.laser-start');
    var laserMsg = laserRoot.querySelector('.mini-game-msg');
    var laserTimer = laserRoot.querySelector('.mini-game-timer');
    var laserScore = laserRoot.querySelector('.mini-game-score');
    var laserStatus = laserRoot.querySelector('.laser-status');
    var laserGap = laserRoot.querySelector('.laser-gap');
    var laserBeam = laserRoot.querySelector('.laser-beam');
    var laserDroid = laserRoot.querySelector('.laser-droid');

    var laserActive = false;
    var laserTimerLoop = null;
    var laserMoveLoop = null;
    var laserTime = 20;
    var laserGoal = 5;
    var laserScoreValue = 0;
    var beamPosition = 18;
    var beamDirection = 1;
    var safeMin = 38;
    var safeMax = 62;

    function updateLaserHud() {
      if (laserTimer) laserTimer.textContent = laserTime + 's';
      if (laserScore) laserScore.textContent = laserScoreValue + '/' + laserGoal;
    }

    function syncLaserVisuals() {
      if (laserGap) {
        laserGap.style.left = safeMin + '%';
        laserGap.style.width = (safeMax - safeMin) + '%';
      }
      if (laserBeam) {
        laserBeam.style.left = beamPosition + '%';
      }
      if (laserDroid) {
        laserDroid.style.left = '50%';
      }
    }

    function failLaserGame() {
      laserActive = false;
      clearInterval(laserTimerLoop);
      clearInterval(laserMoveLoop);
      if (laserMsg) laserMsg.textContent = 'Le faisceau a traversé la zone de sécurité. La cantine est perdue.';
      if (laserStatus) laserStatus.textContent = 'ALERTE MAXIMALE';
      setTimeout(function () {
        window.location.href = 'page19-fin-poison.html#page19';
      }, 1200);
    }

    function winLaserGame() {
      laserActive = false;
      clearInterval(laserTimerLoop);
      clearInterval(laserMoveLoop);
      if (laserMsg) laserMsg.textContent = 'La voie est libre ! Tu sécurises la réserve d’oxygène.';
      if (laserStatus) laserStatus.textContent = 'COUVERTURE STABILISÉE';
      setTimeout(function () {
        window.location.href = 'page20-atelier-maintenance.html#page20';
      }, 1200);
    }

    function triggerLaserCut() {
      if (!laserActive) return;

      var safe = beamPosition >= safeMin && beamPosition <= safeMax;

      if (safe) {
        laserScoreValue += 1;
        updateLaserHud();
        if (laserMsg) laserMsg.textContent = 'Bonne coupure. Le faisceau a été neutralisé.';
        if (laserStatus) laserStatus.textContent = 'Zone verte validée';
        if (laserScoreValue >= laserGoal) {
          winLaserGame();
          return;
        }
        beamPosition = 12;
        beamDirection = 1;
        syncLaserVisuals();
      } else {
        failLaserGame();
      }
    }

    function startLaserGame() {
      laserActive = true;
      laserTime = 20;
      laserScoreValue = 0;
      beamPosition = 12;
      beamDirection = 1;
      updateLaserHud();
      syncLaserVisuals();
      if (laserMsg) laserMsg.textContent = 'Le laser part de gauche à droite. Clique uniquement quand il passe dans la bande verte.';
      if (laserStatus) laserStatus.textContent = 'Zone verte : 38% à 62%';
      clearInterval(laserMoveLoop);
      clearInterval(laserTimerLoop);
      laserMoveLoop = setInterval(function () {
        if (!laserActive) return;
        beamPosition += beamDirection * 2.2;
        if (beamPosition >= 82 || beamPosition <= 8) {
          beamDirection *= -1;
          beamPosition = Math.max(8, Math.min(82, beamPosition));
        }
        if (laserBeam) {
          laserBeam.style.left = beamPosition + '%';
        }
        if (laserStatus && laserActive) {
          var inSafeZone = beamPosition >= safeMin && beamPosition <= safeMax;
          laserStatus.textContent = inSafeZone ? 'ZONE VERTE : CLIQUE !' : 'ZONE VERTE : ATTEND';
        }
      }, 45);
      laserTimerLoop = setInterval(function () {
        if (!laserActive) return;
        laserTime -= 1;
        updateLaserHud();
        if (laserTime <= 0) {
          failLaserGame();
        }
      }, 1000);
    }

    if (laserStart) {
      laserStart.addEventListener('click', function () {
        if (!laserActive) {
          startLaserGame();
          return;
        }
        triggerLaserCut();
      });
    }

    syncLaserVisuals();
    updateLaserHud();
  }
})();
