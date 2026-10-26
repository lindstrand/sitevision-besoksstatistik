import * as React from 'react';
import PropTypes from 'prop-types';
import router from '@sitevision/api/common/router';
import './App.scss';

const LONG_WAIT_MS = 8000;
const VERY_LONG_WAIT_MS = 25000;
const GIVE_UP_MS = 90000;

function paramsFromForm(form, submitter) {
  const parts = [];
  const data = new FormData(form);
  if (submitter && submitter.name) data.set(submitter.name, submitter.value);
  data.forEach((value, key) => {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });
  return parts.join('&');
}

function buildUrl(baseUrl, configQuery, query) {
  const parts = [];
  if (configQuery) parts.push(configQuery);
  if (query) parts.push(query);
  return baseUrl + (parts.length ? (baseUrl.indexOf('?') >= 0 ? '&' : '?') + parts.join('&') : '');
}

const App = ({ configQuery, startupError }) => {
  const rootRef = React.useRef(null);
  const requestIdRef = React.useRef(0);
  const timersRef = React.useRef([]);
  const coreXhrRef = React.useRef(null);
  const fullXhrRef = React.useRef(null);
  const lastParamsRef = React.useRef('');
  const submitterRef = React.useRef(null);

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const abortRequests = React.useCallback(() => {
    [coreXhrRef.current, fullXhrRef.current].forEach((xhr) => {
      if (xhr) {
        try { xhr.abort(); } catch (ignore) {}
      }
    });
    coreXhrRef.current = null;
    fullXhrRef.current = null;
    clearTimers();
  }, [clearTimers]);

  const setStatus = React.useCallback((titleText, bodyText, busy, clearContent) => {
    const root = rootRef.current;
    if (!root) return;
    const status = root.querySelector('.svs-async-status');
    const content = root.querySelector('.svs-async-content');
    if (!status) return;
    if (clearContent && content) content.innerHTML = '';
    status.style.display = 'flex';
    status.removeAttribute('hidden');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-busy', busy ? 'true' : 'false');
    const title = status.querySelector('.svs-async-title');
    const text = status.querySelector('.svs-async-text');
    if (title) title.textContent = titleText;
    if (text) text.textContent = bodyText;
  }, []);

  const hideStatus = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const status = root.querySelector('.svs-async-status');
    if (!status) return;
    status.style.display = 'none';
    status.setAttribute('hidden', '');
    status.setAttribute('aria-busy', 'false');
  }, []);

  const loadRef = React.useRef(null);

  const setError = React.useCallback((timedOut, keepContent) => {
    const root = rootRef.current;
    if (!root) return;
    const content = root.querySelector('.svs-async-content');
    if (keepContent && content && content.innerHTML) {
      setStatus(
        timedOut ? 'Resten av statistiken verkar inte bli klar' : 'All statistik kunde inte hämtas',
        'Grundstatistiken visas fortfarande. Byt period eller öppna Dashboard igen om du vill göra ett nytt försök.',
        false,
        false
      );
      return;
    }
    hideStatus();
    if (!content) return;
    content.innerHTML =
      '<div class="svs-async-error" role="alert">' +
        '<strong>' + (timedOut ? 'Statistiken verkar inte bli klar' : 'Statistiken kunde inte hämtas') + '</strong>' +
        '<p>Försök igen. Om problemet kvarstår kan du stänga Dashboard och öppna den igen.</p>' +
        '<button type="button" class="env-button env-button--primary svs-async-retry">Försök igen</button>' +
      '</div>';
    const retry = content.querySelector('.svs-async-retry');
    if (retry) retry.addEventListener('click', () => {
      if (loadRef.current) loadRef.current(lastParamsRef.current || '');
    });
  }, [hideStatus, setStatus]);

  const loadFull = React.useCallback((query, requestId) => {
    const baseUrl = router.getStandaloneUrl('/statistics') || '';
    if (!baseUrl || requestIdRef.current !== requestId) return;

    setStatus(
      'Grundstatistiken är klar',
      'Länder, enheter och övriga delar hämtas fortfarande…',
      true,
      false
    );

    timersRef.current = [
      window.setTimeout(() => {
        if (requestIdRef.current === requestId) {
          setStatus(
            'Resten av statistiken hämtas fortfarande…',
            'Grundstatistiken går att använda medan de övriga delarna hämtas.',
            true,
            false
          );
        }
      }, LONG_WAIT_MS),
      window.setTimeout(() => {
        if (requestIdRef.current === requestId) {
          setStatus(
            'Det tar längre tid än vanligt',
            'Grundstatistiken visas redan. Dashboard väntar fortfarande på de övriga statistikdelarna.',
            true,
            false
          );
        }
      }, VERY_LONG_WAIT_MS),
      window.setTimeout(() => {
        if (requestIdRef.current !== requestId) return;
        if (fullXhrRef.current) {
          try { fullXhrRef.current.abort(); } catch (ignore) {}
        }
        fullXhrRef.current = null;
        setError(true, true);
      }, GIVE_UP_MS),
    ];

    const xhr = new XMLHttpRequest();
    fullXhrRef.current = xhr;
    xhr.open('GET', buildUrl(baseUrl, configQuery, query), true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4 || requestIdRef.current !== requestId) return;
      clearTimers();
      fullXhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        const root = rootRef.current;
        const content = root && root.querySelector('.svs-async-content');
        if (content) content.innerHTML = xhr.responseText || '';
        hideStatus();
      } else if (xhr.status !== 0) {
        setError(false, true);
      }
    };
    xhr.send();
  }, [clearTimers, configQuery, hideStatus, setError, setStatus]);

  const load = React.useCallback((query) => {
    const baseUrl = router.getStandaloneUrl('/statistics/core') || '';
    if (!baseUrl) {
      setError(false, false);
      return;
    }

    abortRequests();
    lastParamsRef.current = query || '';
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setStatus(
      'Hämtar grundstatistik…',
      'Vi börjar med översikt och mest visade sidor.',
      true,
      true
    );

    const xhr = new XMLHttpRequest();
    coreXhrRef.current = xhr;
    xhr.open('GET', buildUrl(baseUrl, configQuery, query), true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4 || requestIdRef.current !== requestId) return;
      coreXhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        const root = rootRef.current;
        const content = root && root.querySelector('.svs-async-content');
        if (content) content.innerHTML = xhr.responseText || '';
        loadFull(query, requestId);
      } else if (xhr.status !== 0) {
        setStatus(
          'Hämtar statistiken…',
          'Grundsteget kunde inte visas separat. Vi provar att hämta hela statistiken.',
          true,
          true
        );
        loadFull(query, requestId);
      }
    };
    xhr.send();
  }, [abortRequests, configQuery, loadFull, setError, setStatus]);

  loadRef.current = load;

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || startupError) return undefined;

    const onSubmit = (event) => {
      const form = event.target;
      if (!form || !form.closest || !form.closest('.svs')) return;
      event.preventDefault();
      const submitter = event.submitter || submitterRef.current || null;
      submitterRef.current = null;
      load(paramsFromForm(form, submitter));
    };

    const onClick = (event) => {
      const button = event.target && event.target.closest
        ? event.target.closest('button[type="submit"]')
        : null;
      if (button) submitterRef.current = button;
    };

    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick, true);
    load('');

    return () => {
      requestIdRef.current += 1;
      abortRequests();
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick, true);
    };
  }, [abortRequests, load, startupError]);

  if (startupError) {
    return (
      <section className="env-dashboard-widget svs-widget" role="alert">
        <div className="svs-async-error">
          <strong>Besöksstatistiken kunde inte startas.</strong>
          <p>Försök öppna Dashboard igen. Om problemet kvarstår kan en administratör kontrollera Sitevisions applogg.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="env-dashboard-widget svs-widget svs-async" ref={rootRef}>
      <div className="svs-async-status" role="status" aria-live="polite" aria-busy="true">
        <span className="svs-async-spinner" aria-hidden="true" />
        <div>
          <p className="svs-async-title">Hämtar och sammanställer statistik…</p>
          <p className="svs-async-text">Vi börjar med den valda standardperioden.</p>
        </div>
      </div>
      <div className="svs-async-content" />
    </section>
  );
};

App.propTypes = {
  configQuery: PropTypes.string,
  startupError: PropTypes.bool,
};

App.defaultProps = {
  configQuery: '',
  startupError: false,
};

export default App;