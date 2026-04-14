;(function () {
  'use strict'

  var API = (window.KOMETA_BASE || window.location.origin) + '/api'
  var KOMETA_APP = (window.KOMETA_BASE || window.location.origin)
  var MARK = 'data-kometa'
  var MENU_MARK = 'data-kometa-menu'
  var PREFIX = '/komga-proxy'
  var _busy = false   // global busy flag for visual feedback
  var _toastY = 20    // stacked toast offset

  // ─── URL Interceptors ────────────────────────────────────────────────────
  // Komga's frontend may construct absolute URLs pointing to the real Komga
  // server (e.g. for thumbnails, SSE, API calls).  These cross-origin requests
  // get blocked by the Komga server's own response headers.  Intercept and
  // redirect them through our /komga-proxy/ route.
  var KOMGA_ORIGIN = window.KOMETA_KOMGA_ORIGIN || ''

  function _rewriteUrl(url) {
    if (!KOMGA_ORIGIN) return url
    var s = String(url)
    // Skip data/blob/javascript URIs
    if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0 || s.indexOf('javascript:') === 0) return url
    // Direct prefix match (most common case)
    if (s.indexOf(KOMGA_ORIGIN + '/') === 0 || s === KOMGA_ORIGIN) {
      return PREFIX + s.substring(KOMGA_ORIGIN.length)
    }
    // Parse and compare origins (handles port differences, protocol-relative, etc.)
    try {
      var parsed = new URL(s, window.location.origin)
      if (parsed.origin !== window.location.origin && parsed.origin === new URL(KOMGA_ORIGIN).origin) {
        return PREFIX + parsed.pathname + parsed.search
      }
    } catch (e) { /* not a valid URL, pass through */ }
    return url
  }

  // Intercept XMLHttpRequest (used by Axios / Komga's API layer)
  var _origXhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    arguments[1] = _rewriteUrl(url)
    return _origXhrOpen.apply(this, arguments)
  }

  // Intercept fetch()
  if (window.fetch) {
    var _origFetch = window.fetch
    window.fetch = function (input, init) {
      if (typeof input === 'string') {
        input = _rewriteUrl(input)
      } else if (input instanceof Request) {
        var rewritten = _rewriteUrl(input.url)
        if (rewritten !== input.url) input = new Request(rewritten, input)
      }
      return _origFetch.call(this, input, init)
    }
  }

  // Intercept EventSource (Komga SSE for real-time updates)
  if (window.EventSource) {
    var _OrigES = window.EventSource
    window.EventSource = function (url, opts) {
      return new _OrigES(_rewriteUrl(url), opts)
    }
    window.EventSource.prototype = _OrigES.prototype
    window.EventSource.CONNECTING = _OrigES.CONNECTING
    window.EventSource.OPEN = _OrigES.OPEN
    window.EventSource.CLOSED = _OrigES.CLOSED
  }

  // ─── Styles ──────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('kometa-css')) return
    var s = document.createElement('style')
    s.id = 'kometa-css'
    s.textContent = [
      // Dropdown menu
      '.kometa-dropdown{position:absolute;top:100%;right:0;z-index:100000;min-width:220px;background:#1e1e2e;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);padding:4px 0;display:none;font-family:Roboto,sans-serif}',
      '.kometa-dropdown.open{display:block}',
      '.kometa-dropdown-item{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;color:#cdd6f4;font-size:14px;white-space:nowrap;user-select:none}',
      '.kometa-dropdown-item:hover{background:rgba(137,180,250,.1)}',
      '.kometa-dropdown-item .mdi{font-size:18px;color:#89b4fa;width:20px;text-align:center}',
      '.kometa-dropdown-sep{height:1px;background:rgba(255,255,255,.08);margin:4px 0}',
      '.kometa-dropdown-header{padding:6px 16px;font-size:11px;font-weight:700;color:#89b4fa;text-transform:uppercase;letter-spacing:.5px}',

      // Modal
      '.kometa-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;font-family:Roboto,sans-serif}',
      '.kometa-modal{background:#1e1e2e;border-radius:12px;width:680px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#cdd6f4}',
      '.kometa-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.08)}',
      '.kometa-modal-header h3{margin:0;font-size:16px;font-weight:600;color:#cdd6f4}',
      '.kometa-modal-body{flex:1;overflow-y:auto;padding:16px 20px}',
      '.kometa-modal-footer{padding:12px 20px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;gap:8px}',

      '.kometa-input{width:100%;padding:8px 12px;border:1px solid rgba(255,255,255,.15);border-radius:6px;background:#181825;color:#cdd6f4;font-size:14px;outline:none;box-sizing:border-box}',
      '.kometa-input:focus{border-color:#89b4fa}',
      '.kometa-label{display:block;font-size:12px;font-weight:600;color:#a6adc8;margin-bottom:6px}',
      '.kometa-row{display:flex;gap:10px;margin-bottom:12px;align-items:flex-end}',
      '.kometa-row>*{flex:1}',
      '.kometa-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
      '.kometa-chip{padding:4px 10px;border-radius:12px;font-size:12px;cursor:pointer;border:1px solid rgba(255,255,255,.15);background:#181825;color:#a6adc8;user-select:none;transition:all .15s}',
      '.kometa-chip.active{background:#89b4fa;color:#1e1e2e;border-color:#89b4fa}',
      '.kometa-chip:hover{border-color:#89b4fa}',

      '.kometa-btn{padding:7px 16px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .15s}',
      '.kometa-btn-primary{background:#89b4fa;color:#1e1e2e}',
      '.kometa-btn-primary:hover{background:#b4d0fb}',
      '.kometa-btn-primary:disabled{opacity:.4;cursor:not-allowed}',
      '.kometa-btn-secondary{background:transparent;color:#a6adc8;border:1px solid rgba(255,255,255,.15)}',
      '.kometa-btn-secondary:hover{background:rgba(255,255,255,.05)}',
      '.kometa-btn-close{background:none;border:none;color:#6c7086;font-size:22px;cursor:pointer;padding:0 4px;line-height:1}',
      '.kometa-btn-close:hover{color:#cdd6f4}',

      '.kometa-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:12px}',
      '.kometa-card{border:2px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;cursor:pointer;transition:all .15s;background:#181825}',
      '.kometa-card:hover{border-color:#89b4fa;transform:translateY(-2px)}',
      '.kometa-card.selected{border-color:#a6e3a1;box-shadow:0 0 12px rgba(166,227,161,.2)}',
      '.kometa-card img{width:100%;height:200px;object-fit:cover;background:#11111b}',
      '.kometa-card-noimg{width:100%;height:200px;display:flex;align-items:center;justify-content:center;background:#11111b;color:#45475a;font-size:13px}',
      '.kometa-card-info{padding:8px 10px}',
      '.kometa-card-title{font-size:13px;font-weight:500;color:#cdd6f4;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.kometa-card-provider{font-size:11px;color:#89b4fa;margin-top:4px}',

      '.kometa-toast{position:fixed;bottom:20px;right:20px;z-index:200000;padding:10px 16px;border-radius:8px;font-size:13px;color:#fff;animation:kometa-fi .2s}',
      '.kometa-ts{background:rgba(16,120,60,0.95)}',
      '.kometa-te{background:rgba(160,35,35,0.95)}',
      '@keyframes kometa-fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',

      '.kometa-spinner{display:flex;justify-content:center;padding:32px}',
      '.kometa-spin{width:28px;height:28px;border:3px solid rgba(255,255,255,.1);border-top-color:#89b4fa;border-radius:50%;animation:kometa-sp .7s linear infinite}',
      '@keyframes kometa-sp{to{transform:rotate(360deg)}}',

      '.kometa-empty{text-align:center;padding:24px;color:#6c7086;font-size:14px}',

      // Context menu items injected into Komga's Vuetify menus
      '.kometa-menu-item{min-height:36px;padding:0 16px;display:flex;align-items:center;cursor:pointer;color:rgba(255,255,255,.87);font-size:13px}',
      '.kometa-menu-item:hover{background:rgba(255,255,255,.08)}',
      '.kometa-menu-item .mdi{font-size:18px;margin-right:12px;color:#89b4fa}',
      '.kometa-menu-divider{height:1px;background:rgba(255,255,255,.12);margin:4px 0}',

      // Busy pulse on toolbar icon
      '.kometa-busy .v-icon{animation:kometa-pulse 1s ease-in-out infinite}',
      '@keyframes kometa-pulse{0%,100%{opacity:1}50%{opacity:.3}}',

      // Confirmation dialog (replaces native confirm)
      '.kometa-confirm{background:#1e1e2e;border-radius:12px;width:380px;max-width:90vw;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#cdd6f4;text-align:center}',
      '.kometa-confirm h3{margin:0 0 8px;font-size:16px;font-weight:600}',
      '.kometa-confirm p{margin:0 0 20px;font-size:14px;color:#a6adc8}',
      '.kometa-confirm-btns{display:flex;justify-content:center;gap:10px}',
    ].join('\n')
    document.head.appendChild(s)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function toast(msg, ok) {
    var el = document.createElement('div')
    el.className = 'kometa-toast ' + (ok ? 'kometa-ts' : 'kometa-te')
    el.textContent = msg
    el.style.bottom = _toastY + 'px'
    _toastY += 44
    document.body.appendChild(el)
    var currentOffset = _toastY
    setTimeout(function () {
      el.style.opacity = '0'
      el.style.transition = 'opacity .25s'
      setTimeout(function () { el.remove(); _toastY = Math.max(20, _toastY - 44) }, 260)
    }, 3500)
  }

  function setBusy(on) {
    _busy = on
    var btns = document.querySelectorAll('[' + MARK + '] button')
    for (var i = 0; i < btns.length; i++) {
      if (on) btns[i].classList.add('kometa-busy')
      else btns[i].classList.remove('kometa-busy')
    }
  }

  function showConfirm(title, message) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div')
      overlay.className = 'kometa-overlay'
      var box = document.createElement('div')
      box.className = 'kometa-confirm'
      box.innerHTML = '<h3>' + escHtml(title) + '</h3><p>' + escHtml(message) + '</p>'
      var btns = document.createElement('div')
      btns.className = 'kometa-confirm-btns'
      var noBtn = document.createElement('button')
      noBtn.className = 'kometa-btn kometa-btn-secondary'
      noBtn.textContent = 'Cancel'
      noBtn.onclick = function () { overlay.remove(); resolve(false) }
      var yesBtn = document.createElement('button')
      yesBtn.className = 'kometa-btn kometa-btn-primary'
      yesBtn.textContent = 'Confirm'
      yesBtn.onclick = function () { overlay.remove(); resolve(true) }
      btns.appendChild(noBtn)
      btns.appendChild(yesBtn)
      box.appendChild(btns)
      overlay.appendChild(box)
      overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); resolve(false) } })
      document.body.appendChild(overlay)
    })
  }

  function apiCall(method, path, body) {
    var opts = { method: method }
    if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' }
      opts.body = JSON.stringify(body)
    }
    return fetch(API + path, opts).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.statusText) })
      if (res.status === 204) return null
      var ct = res.headers.get('content-type') || ''
      return ct.indexOf('json') >= 0 ? res.json() : res.text()
    })
  }

  function getRealPath() {
    var p = window.location.pathname
    if (p.startsWith(PREFIX + '/')) return p.slice(PREFIX.length)
    if (p === PREFIX) return '/'
    return p
  }

  function getSeriesId() {
    var parts = getRealPath().split('/')
    for (var i = 0; i < parts.length; i++) {
      if ((parts[i] === 'series' || parts[i] === 'oneshot') && parts[i + 1]) return parts[i + 1]
    }
    return null
  }

  function getLibraryId() {
    var parts = getRealPath().split('/')
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === 'libraries' && parts[i + 1]) return parts[i + 1]
    }
    return null
  }

  function getLibraryIdFromToolbar() {
    var toolbar = document.querySelector('.v-main__wrap .v-toolbar__content')
    if (!toolbar) return null
    var children = toolbar.children
    for (var i = 0; i < children.length; i++) {
      var href = children[i].getAttribute('href')
      if (href && /\/libraries/.test(href)) {
        var parts = href.split('/')
        for (var j = 0; j < parts.length; j++) {
          if (parts[j] === 'libraries' && parts[j + 1]) return parts[j + 1]
        }
      }
    }
    return null
  }

  function getSeriesTitle() {
    var el = document.querySelector('.v-main__wrap .v-toolbar__content .v-toolbar__title span')
      || document.querySelector('.v-main__wrap .container--fluid .container span.text-h6')
    return el ? el.innerText : ''
  }

  function escHtml(s) {
    var d = document.createElement('div')
    d.textContent = s || ''
    return d.innerHTML
  }

  // ─── Series info extraction from card ────────────────────────────────────

  function getSeriesInfoFromCard(el) {
    var vCard = el.closest('.v-card')
    if (!vCard) return null

    var links = vCard.querySelectorAll('a[href]')
    var seriesId = null, libraryId = null
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || ''
      if (href.startsWith(PREFIX)) href = href.slice(PREFIX.length)
      var sm = href.match(/\/(series|oneshot)\/([^/?]+)/)
      if (sm) seriesId = sm[2]
      var lm = href.match(/\/libraries\/([^/?]+)/)
      if (lm) libraryId = lm[1]
    }

    if (!seriesId) {
      var img = vCard.querySelector('.v-image__image')
      if (img) {
        var bg = img.style.backgroundImage || ''
        var tm = bg.match(/\/api\/v1\/series\/([^/]+)\/thumbnail/)
        if (tm) seriesId = tm[1]
      }
    }

    var titleEl = vCard.querySelector('.v-card__subtitle')
    var title = titleEl ? titleEl.textContent.trim() : ''

    if (!seriesId) return null
    return { seriesId: seriesId, libraryId: libraryId, title: title }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  function doIdentify(seriesId, libraryId, title) {
    showIdentifyModal(seriesId, libraryId, title)
  }

  function doAutoMatch(seriesId, libraryId, title) {
    if (!libraryId || !seriesId) { toast('Library/Series ID not found', false); return }
    setBusy(true)
    apiCall('POST', '/komga/metadata/match/library/' + libraryId + '/series/' + seriesId)
      .then(function () { toast('Match started' + (title ? ' — ' + title : ''), true) })
      .catch(function (e) { toast('Match error: ' + e.message, false) })
      .finally(function () { setBusy(false) })
  }

  function doResetSeries(seriesId, libraryId, title) {
    if (!libraryId || !seriesId) { toast('Library/Series ID not found', false); return }
    showConfirm('Reset metadata', 'Reset metadata for ' + (title || 'this series') + '?').then(function (ok) {
      if (!ok) return
      setBusy(true)
      apiCall('POST', '/komga/metadata/reset/library/' + libraryId + '/series/' + seriesId)
        .then(function () { toast('Reset complete' + (title ? ' — ' + title : ''), true) })
        .catch(function (e) { toast('Reset error: ' + e.message, false) })
        .finally(function () { setBusy(false) })
    })
  }

  function doMatchLibrary(libraryId) {
    if (!libraryId) { toast('Library ID not found', false); return }
    showConfirm('Match library', 'Start automatic match for the entire library?').then(function (ok) {
      if (!ok) return
      setBusy(true)
      apiCall('POST', '/komga/metadata/match/library/' + libraryId)
        .then(function () { toast('Library match started', true) })
        .catch(function (e) { toast('Library match error: ' + e.message, false) })
        .finally(function () { setBusy(false) })
    })
  }

  function doResetLibrary(libraryId) {
    if (!libraryId) { toast('Library ID not found', false); return }
    showConfirm('Reset library', 'Reset metadata for the entire library? This action cannot be undone.').then(function (ok) {
      if (!ok) return
      setBusy(true)
      apiCall('POST', '/komga/metadata/reset/library/' + libraryId)
        .then(function () { toast('Library reset complete', true) })
        .catch(function (e) { toast('Library reset error: ' + e.message, false) })
        .finally(function () { setBusy(false) })
    })
  }

  // ─── Identify Modal ─────────────────────────────────────────────────────

  function closeModal() {
    var ov = document.querySelector('.kometa-overlay')
    if (ov) ov.remove()
  }

  function showIdentifyModal(seriesId, libraryId, seriesName) {
    closeModal()

    var overlay = document.createElement('div')
    overlay.className = 'kometa-overlay'
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal() })

    var modal = document.createElement('div')
    modal.className = 'kometa-modal'

    var header = document.createElement('div')
    header.className = 'kometa-modal-header'
    header.innerHTML = '<h3>Identify \u2014 ' + escHtml(seriesName || 'Serie') + '</h3>'
    var closeBtn = document.createElement('button')
    closeBtn.className = 'kometa-btn-close'
    closeBtn.innerHTML = '&times;'
    closeBtn.onclick = closeModal
    header.appendChild(closeBtn)
    modal.appendChild(header)

    var body = document.createElement('div')
    body.className = 'kometa-modal-body'

    // Provider chips
    var chipLabel = document.createElement('div')
    chipLabel.className = 'kometa-label'
    chipLabel.textContent = 'Provider'
    body.appendChild(chipLabel)

    var chipWrap = document.createElement('div')
    chipWrap.className = 'kometa-chips'
    body.appendChild(chipWrap)

    var selectedProvider = null
    var providerChips = []

    apiCall('GET', '/komga/metadata/providers' + (libraryId ? '?libraryId=' + libraryId : ''))
      .then(function (providers) {
        if (!providers || !providers.length) {
          chipWrap.innerHTML = '<span class="kometa-empty">No providers configured</span>'
          return
        }
        providers.forEach(function (p) {
          var chip = document.createElement('span')
          chip.className = 'kometa-chip'
          chip.textContent = p
          chip.onclick = function () {
            providerChips.forEach(function (c) { c.classList.remove('active') })
            chip.classList.add('active')
            selectedProvider = p
          }
          chipWrap.appendChild(chip)
          providerChips.push(chip)
        })
      })

    // Search row
    var row = document.createElement('div')
    row.className = 'kometa-row'

    var nameWrap = document.createElement('div')
    var nameLabel = document.createElement('div')
    nameLabel.className = 'kometa-label'
    nameLabel.textContent = 'Series name'
    var nameInput = document.createElement('input')
    nameInput.className = 'kometa-input'
    nameInput.value = seriesName || ''
    nameInput.placeholder = 'Search\u2026'
    nameWrap.appendChild(nameLabel)
    nameWrap.appendChild(nameInput)
    row.appendChild(nameWrap)

    var searchBtnWrap = document.createElement('div')
    searchBtnWrap.style.flex = '0'
    var searchBtn = document.createElement('button')
    searchBtn.className = 'kometa-btn kometa-btn-primary'
    searchBtn.textContent = 'Search'
    searchBtnWrap.appendChild(searchBtn)
    row.appendChild(searchBtnWrap)

    body.appendChild(row)

    var resultsWrap = document.createElement('div')
    body.appendChild(resultsWrap)

    var footer = document.createElement('div')
    footer.className = 'kometa-modal-footer'
    var cancelBtn = document.createElement('button')
    cancelBtn.className = 'kometa-btn kometa-btn-secondary'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.onclick = closeModal

    var applyBtn = document.createElement('button')
    applyBtn.className = 'kometa-btn kometa-btn-primary'
    applyBtn.textContent = 'Apply'
    applyBtn.disabled = true

    footer.appendChild(cancelBtn)
    footer.appendChild(applyBtn)

    modal.appendChild(body)
    modal.appendChild(footer)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    var selectedResult = null

    function doSearch() {
      var q = nameInput.value.trim()
      if (!q) return
      resultsWrap.innerHTML = '<div class="kometa-spinner"><div class="kometa-spin"></div></div>'
      selectedResult = null
      applyBtn.disabled = true

      var params = '?name=' + encodeURIComponent(q)
      if (seriesId) params += '&seriesId=' + seriesId
      if (libraryId) params += '&libraryId=' + libraryId

      apiCall('GET', '/komga/metadata/search' + params)
        .then(function (results) {
          resultsWrap.innerHTML = ''
          if (!results || !results.length) {
            resultsWrap.innerHTML = '<div class="kometa-empty">No results</div>'
            return
          }

          var grid = document.createElement('div')
          grid.className = 'kometa-results'

          results.forEach(function (r) {
            var card = document.createElement('div')
            card.className = 'kometa-card'

            if (r.imageUrl) {
              var img = document.createElement('img')
              img.src = r.imageUrl
              img.loading = 'lazy'
              img.onerror = function () {
                img.style.display = 'none'
                var ph2 = document.createElement('div')
                ph2.className = 'kometa-card-noimg'
                ph2.textContent = 'No image'
                card.insertBefore(ph2, card.firstChild)
              }
              card.appendChild(img)
            } else {
              var ph = document.createElement('div')
              ph.className = 'kometa-card-noimg'
              ph.textContent = 'No image'
              card.appendChild(ph)
            }

            var info = document.createElement('div')
            info.className = 'kometa-card-info'
            info.innerHTML =
              '<div class="kometa-card-title">' + escHtml(r.title) + '</div>' +
              '<div class="kometa-card-provider">' + escHtml(r.provider) + '</div>'
            card.appendChild(info)

            card.onclick = function () {
              grid.querySelectorAll('.kometa-card').forEach(function (c) { c.classList.remove('selected') })
              card.classList.add('selected')
              selectedResult = r
              applyBtn.disabled = false
            }
            grid.appendChild(card)
          })
          resultsWrap.appendChild(grid)
        })
        .catch(function (err) {
          resultsWrap.innerHTML = '<div class="kometa-empty" style="color:#f38ba8">Error: ' + escHtml(err.message) + '</div>'
        })
    }

    searchBtn.onclick = doSearch
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch() })

    applyBtn.onclick = function () {
      if (!selectedResult) return
      applyBtn.disabled = true
      applyBtn.textContent = 'Applying\u2026'
      apiCall('POST', '/komga/metadata/identify', {
        libraryId: libraryId || null,
        seriesId: seriesId,
        provider: selectedResult.provider,
        providerSeriesId: selectedResult.resultId,
      })
        .then(function () {
          toast('Identify started', true)
          closeModal()
        })
        .catch(function (err) {
          toast('Error: ' + err.message, false)
          applyBtn.disabled = false
          applyBtn.textContent = 'Apply'
        })
    }

    if (seriesName) setTimeout(doSearch, 300)
  }

  // ─── Toolbar button with dropdown ────────────────────────────────────────

  function createToolbarButton() {
    var wrapper = document.createElement('div')
    wrapper.setAttribute(MARK, '1')
    wrapper.style.position = 'relative'
    wrapper.style.display = 'inline-flex'

    var btn = document.createElement('button')
    btn.className = 'v-btn v-btn--icon v-btn--round theme--dark v-size--default'
    btn.setAttribute('title', 'KometaManga')
    btn.innerHTML = '<span class="v-btn__content"><i class="v-icon notranslate mdi mdi-puzzle theme--dark" style="font-size:24px"></i></span>'

    var dropdown = document.createElement('div')
    dropdown.className = 'kometa-dropdown'

    function closeDropdown() { dropdown.classList.remove('open') }

    function buildDropdown() {
      dropdown.innerHTML = ''

      var seriesId = getSeriesId()
      var libraryId = getLibraryId() || getLibraryIdFromToolbar()

      if (seriesId) {
        // ── Inside a specific series/manga ──
        var lid = libraryId
        var title = getSeriesTitle()
        addDropdownHeader(dropdown, title || 'Questa serie')
        addDropdownIcon(dropdown, 'mdi-magnify', 'Identify', function () {
          closeDropdown()
          doIdentify(seriesId, lid, title)
        })
        addDropdownIcon(dropdown, 'mdi-auto-fix', 'Match automatico', function () {
          closeDropdown()
          doAutoMatch(seriesId, lid, title)
        })
        addDropdownIcon(dropdown, 'mdi-backup-restore', 'Reset metadati', function () {
          closeDropdown()
          doResetSeries(seriesId, lid, title)
        })
      } else if (libraryId) {
        // ── Library list page ──
        addDropdownHeader(dropdown, 'Libreria')
        addDropdownIcon(dropdown, 'mdi-auto-fix', 'Match tutta la libreria', function () {
          closeDropdown()
          doMatchLibrary(libraryId)
        })
        addDropdownIcon(dropdown, 'mdi-backup-restore', 'Reset tutta la libreria', function () {
          closeDropdown()
          doResetLibrary(libraryId)
        })
      } else {
        // ── Home / other page ──
        var hint = document.createElement('div')
        hint.className = 'kometa-dropdown-item'
        hint.style.color = '#6c7086'
        hint.style.cursor = 'default'
        hint.innerHTML = '<i class="mdi mdi-information-outline" style="color:#6c7086"></i>'
        var span = document.createElement('span')
        span.textContent = 'Navigate to a library or series'
        hint.appendChild(span)
        dropdown.appendChild(hint)
      }

      // ── Always show: separator + KometaManga link ──
      var sep = document.createElement('div')
      sep.className = 'kometa-dropdown-sep'
      dropdown.appendChild(sep)
      addDropdownIcon(dropdown, 'mdi-open-in-new', 'Apri KometaManga', function () {
        closeDropdown()
        window.open(KOMETA_APP, '_blank')
      })
    }

    btn.onclick = function (e) {
      e.stopPropagation()
      if (dropdown.classList.contains('open')) {
        closeDropdown()
      } else {
        buildDropdown()
        dropdown.classList.add('open')
      }
    }

    document.addEventListener('click', function () { closeDropdown() })

    wrapper.appendChild(btn)
    wrapper.appendChild(dropdown)
    return wrapper
  }

  function addDropdownHeader(dropdown, text) {
    var h = document.createElement('div')
    h.className = 'kometa-dropdown-header'
    h.textContent = text
    dropdown.appendChild(h)
  }

  function addDropdownIcon(dropdown, icon, label, onClick) {
    var item = document.createElement('div')
    item.className = 'kometa-dropdown-item'
    item.innerHTML = '<i class="mdi ' + icon + '"></i>'
    var span = document.createElement('span')
    span.textContent = label
    item.appendChild(span)
    item.onclick = function (e) {
      e.stopPropagation()
      onClick()
    }
    dropdown.appendChild(item)
  }

  // ─── Context menu injection into Komga's series card 3-dot menus ────────

  function injectMenuItems(menuContent, seriesInfo) {
    if (menuContent.querySelector('[' + MENU_MARK + ']')) return

    var list = menuContent.querySelector('.v-list')
    if (!list) return

    // Separator
    var sep = document.createElement('div')
    sep.className = 'kometa-menu-divider'
    sep.setAttribute(MENU_MARK, '1')
    list.appendChild(sep)

    // Identify
    var identifyItem = createMenuItem('mdi-magnify', 'Identify serie')
    identifyItem.onclick = function (e) {
      e.stopPropagation()
      closeAllMenus()
      doIdentify(seriesInfo.seriesId, seriesInfo.libraryId, seriesInfo.title)
    }
    list.appendChild(identifyItem)

    // Auto Match
    var matchItem = createMenuItem('mdi-auto-fix', 'Match automatico')
    matchItem.onclick = function (e) {
      e.stopPropagation()
      closeAllMenus()
      doAutoMatch(seriesInfo.seriesId, seriesInfo.libraryId, seriesInfo.title)
    }
    list.appendChild(matchItem)

    // Reset
    var resetItem = createMenuItem('mdi-backup-restore', 'Reset metadati')
    resetItem.onclick = function (e) {
      e.stopPropagation()
      closeAllMenus()
      doResetSeries(seriesInfo.seriesId, seriesInfo.libraryId, seriesInfo.title)
    }
    list.appendChild(resetItem)
  }

  function createMenuItem(icon, label) {
    var item = document.createElement('div')
    item.className = 'kometa-menu-item'
    item.setAttribute(MENU_MARK, '1')
    item.innerHTML = '<i class="mdi ' + icon + '"></i>'
    var span = document.createElement('span')
    span.textContent = label
    item.appendChild(span)
    return item
  }

  function closeAllMenus() {
    document.body.click()
  }

  // ─── Toolbar injection (decoupled from MutationObserver) ────────────────

  function tryInjectToolbar() {
    var toolbars = document.querySelectorAll('.v-main__wrap .v-toolbar__content')
    for (var t = 0; t < toolbars.length; t++) {
      var tb = toolbars[t]
      if (tb.parentElement && tb.parentElement.classList.contains('hidden-sm-and-up')) continue
      if (tb.querySelector('[' + MARK + ']')) continue
      if (tb.children.length === 0) continue

      console.log('[KometaManga] toolbar button injected')
      var toolbarBtn = createToolbarButton()
      tb.appendChild(toolbarBtn)
    }
  }

  // Poll for URL changes — Vue Router doesn't fire popstate on push navigation
  var _lastUrl = ''
  function startUrlWatcher() {
    setInterval(function () {
      var url = window.location.href
      if (url !== _lastUrl) {
        _lastUrl = url
        // Wait for Vue to finish rendering the new route
        setTimeout(tryInjectToolbar, 600)
      }
    }, 250)
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────

  function bootstrap() {
    injectStyles()

    // MutationObserver ONLY for context menus (v-menu__content)
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var addedNodes = mutations[m].addedNodes
        if (!addedNodes || addedNodes.length === 0) continue

        for (var n = 0; n < addedNodes.length; n++) {
          var node = addedNodes[n]
          if (node.nodeType !== 1) continue

          if (node.classList && node.classList.contains('v-menu__content')) {
            handleNewMenu(node)
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: false })

    // Toolbar injection via URL watcher (no DOM interference during Vue transitions)
    _lastUrl = window.location.href
    startUrlWatcher()

    // Initial injection after page load
    setTimeout(tryInjectToolbar, 1000)

    // ── Keyboard shortcut: Ctrl+Shift+K → Identify current series ──
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        var sid = getSeriesId()
        if (sid) {
          var lid = getLibraryId() || getLibraryIdFromToolbar()
          var title = getSeriesTitle()
          doIdentify(sid, lid, title)
        } else {
          toast('Navigate to a series page to use Identify', false)
        }
      }
    })

    // ── Auto-close dropdowns on scroll ──
    var mainWrap = document.querySelector('.v-main__wrap') || window
    mainWrap.addEventListener('scroll', function () {
      var openDd = document.querySelectorAll('.kometa-dropdown.open')
      for (var i = 0; i < openDd.length; i++) openDd[i].classList.remove('open')
    }, true)

    console.log('[KometaManga] injection active — API:', API, '| Ctrl+Shift+K = Identify')
  }

  function handleNewMenu(menuContent) {
    // Small delay for Vuetify to finish rendering list items
    setTimeout(function () {
      if (menuContent.querySelector('[' + MENU_MARK + ']')) return

      // Check this is a series action menu by looking for known Komga menu items
      var items = menuContent.querySelectorAll('.v-list-item')
      var isSeriesMenu = false
      for (var i = 0; i < items.length; i++) {
        var text = (items[i].textContent || '').trim().toLowerCase()
        // Match Komga's series menu items (English and potential i18n variants)
        if (text === 'analyze' || text === 'refresh metadata' ||
            text === 'add to collection' || text === 'mark as read' ||
            text === 'mark as unread' || text === 'delete') {
          isSeriesMenu = true
          break
        }
      }
      if (!isSeriesMenu) return

      // Find the activator button (the 3-dot icon that was clicked)
      var seriesInfo = findSeriesFromActivator()
      if (!seriesInfo || !seriesInfo.seriesId) {
        console.log('[KometaManga] could not extract series info from menu activator')
        return
      }

      // Fill libraryId from page if missing
      if (!seriesInfo.libraryId) {
        seriesInfo.libraryId = getLibraryId() || getLibraryIdFromToolbar()
      }

      console.log('[KometaManga] context menu for:', seriesInfo.title || seriesInfo.seriesId)
      injectMenuItems(menuContent, seriesInfo)
    }, 80)
  }

  function findSeriesFromActivator() {
    // Find the active mdi-dots-vertical button (aria-expanded="true")
    var dots = document.querySelectorAll('.mdi-dots-vertical')
    for (var i = 0; i < dots.length; i++) {
      var btn = dots[i].closest('button')
      if (!btn || btn.getAttribute('aria-expanded') !== 'true') continue

      // Walk up to find the card
      var overlay = btn.closest('.v-overlay')
      if (overlay) {
        var card = overlay.closest('.v-card')
        if (card) {
          var info = getSeriesInfoFromCard(card)
          if (info) return info
        }
      }

      // Direct parent card
      var directCard = btn.closest('.v-card')
      if (directCard) {
        var info2 = getSeriesInfoFromCard(directCard)
        if (info2) return info2
      }
    }
    return null
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
})()
