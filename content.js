(() => {
  'use strict';

  const BASE_TITLE = "Your voice. Your ideas. Uncensored.";

  const POST_TEXT_SELECTOR = "div.mt-1.text-foreground.break-words.whitespace-pre-wrap";
  const POST_CARD_SELECTOR = "div.border-b.border-border.bg-card";
  const USERNAME_SELECTOR = "span.font-bold.text-foreground.text-base";
  const BOOKMARKS_KEY = "bookmarks";
  const BOOKMARK_BUTTON_CLASS = "ks-bookmark-button";
  const BOOKMARKS_VIEW_ID = "ks-bookmarks-view";
  const BOOKMARKS_NAV_ID = "ks-nav-bookmarks";
  const TURQUOISE_HOVER_STYLE_ID = "ks-theme-turquoise-hover";
  const TURQUOISE_LOGO_COLOR = "#70C7BA";
  const TURQUOISE_LOGO_ORIGINAL_ATTR = "data-ks-logo-original";
  const DEFAULT_DOMAINS = ["https://k-social.network/*"];

  const BADGE_SELECTOR = "span.bg-red-500.text-white.rounded-full, span.bg-red-500.text-white";

  const I18N = {
    de: {
      translate_link: "Übersetzen mit DeepL",
      translating: "Übersetze…",
      translated: "Übersetzt",
      translate_error: "Fehler beim Übersetzen"
    },
    en: {
      translate_link: "Translate with DeepL",
      translating: "Translating…",
      translated: "Translated",
      translate_error: "Translation failed"
    },
    fr: {
      translate_link: "Traduire avec DeepL",
      translating: "Traduction…",
      translated: "Traduit",
      translate_error: "Échec de la traduction"
    },
    es: {
      translate_link: "Traducir con DeepL",
      translating: "Traduciendo…",
      translated: "Traducido",
      translate_error: "Error al traducir"
    },
    it: {
      translate_link: "Traduci con DeepL",
      translating: "Traduzione…",
      translated: "Tradotto",
      translate_error: "Errore di traduzione"
    },
    nl: {
      translate_link: "Vertalen met DeepL",
      translating: "Vertalen…",
      translated: "Vertaald",
      translate_error: "Vertaling mislukt"
    },
    pl: {
      translate_link: "Tłumacz z DeepL",
      translating: "Tłumaczenie…",
      translated: "Przetłumaczono",
      translate_error: "Błąd tłumaczenia"
    }
  };
  const TRANSLATE_LINK_LABELS = new Set(Object.values(I18N).map((entry) => entry.translate_link));

  function localeFromLang(lang) {
    const normalized = (lang || "DE").toUpperCase();
    const map = {
      DE: "de",
      EN: "en",
      FR: "fr",
      ES: "es",
      IT: "it",
      NL: "nl",
      PL: "pl"
    };
    return map[normalized] || "en";
  }

  function normalizePatterns(lines) {
    // Allow "https://k-social.network/" -> treat as "https://k-social.network/*"
    return lines.map(p => {
      if (!p) return "";
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.endsWith("*")) return trimmed;
      // If looks like a base URL ending with '/', treat as wildcard prefix
      if (trimmed.endsWith("/")) return trimmed + "*";
      return trimmed; // exact match
    }).filter(Boolean);
  }

  function coerceDomainList(value, fallback) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      return value.split(/\n+/).map((v) => v.trim()).filter(Boolean);
    }
    return fallback;
  }

  function urlMatches(url, patterns) {
    return patterns.some(p => {
      if (p.endsWith("*")) return url.startsWith(p.slice(0, -1));
      return url === p;
    });
  }

  function setTitleFromCount(rawCount) {
    if (rawCount && rawCount !== "0") {
      document.title = `(${rawCount}) ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
  }

  function isSettingsPage() {
    return location.pathname === "/settings" || location.pathname.startsWith("/settings/");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripTranslateLinkText(text) {
    if (!text) return "";
    const labels = Array.from(TRANSLATE_LINK_LABELS);
    const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    let cleaned = text;
    escapedLabels.forEach((label) => {
      cleaned = cleaned.replace(new RegExp(`\\s*${label}\\s*$`, "i"), "");
    });
    const lowered = labels.map((label) => label.toLowerCase());
    cleaned = cleaned
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        return !lowered.includes(trimmed.toLowerCase());
      })
      .join("\n");
    return cleaned.trim();
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  function resolveHref(href) {
    if (!href) return "";
    try {
      return new URL(href, location.origin).toString();
    } catch {
      return "";
    }
  }

  function findUserDetailsModal() {
    return Array.from(document.querySelectorAll("div.bg-popover")).find((modal) => {
      const heading = modal.querySelector("h2");
      return heading && (heading.textContent || "").trim() === "User Details";
    }) || null;
  }

  function extractModalField(modal, labelText) {
    const labels = Array.from(modal.querySelectorAll("label"));
    const label = labels.find((el) => (el.textContent || "").trim() === labelText);
    if (!label) return "";
    const group = label.closest("div.space-y-2");
    const valueEl = group ? group.querySelector("span.text-sm") : null;
    return valueEl ? (valueEl.textContent || "").trim() : "";
  }

  function waitForUserDetailsModal(timeoutMs = 1500) {
    return new Promise((resolve) => {
      const existing = findUserDetailsModal();
      if (existing) {
        resolve(existing);
        return;
      }
      let resolved = false;
      const observer = new MutationObserver(() => {
        const modal = findUserDetailsModal();
        if (modal) {
          resolved = true;
          observer.disconnect();
          resolve(modal);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (resolved) return;
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  }

  async function fetchUserDetailsFromCard(card) {
    const avatarTarget =
      card.querySelector("img[data-slot='avatar-image']") ||
      card.querySelector("span[data-slot='avatar']");
    const clickTarget =
      (avatarTarget && avatarTarget.closest("button, a")) ||
      avatarTarget;
    if (!clickTarget) return null;

    const existingModal = findUserDetailsModal();
    let openedByScript = false;
    if (!existingModal) {
      clickTarget.click();
      openedByScript = true;
    }
    const modal = existingModal || (await waitForUserDetailsModal());
    if (!modal) return null;

    const nickname = extractModalField(modal, "Nickname");
    const publicKey = extractModalField(modal, "Public Key");
    if (openedByScript) {
      const closeButton = modal.querySelector("button svg.lucide-x")?.closest("button");
      if (closeButton) {
        closeButton.click();
      }
    }
    if (!publicKey && !nickname) return null;
    return { nickname, publicKey };
  }

  chrome.storage.local.get(
    {
      apiKey: "",
      lang: "DE",
      domains: DEFAULT_DOMAINS,
      notificationsEnabled: false,
      tabTitleEnabled: true,
      bookmarksEnabled: true,
      hideTransactionPopup: false,
      turquoiseThemeEnabled: false,
      debugLogEnabled: false
    },
    (cfg) => {
      let currentLocale = localeFromLang(cfg.lang);
      const t = (key) => {
        const table = I18N[currentLocale] || I18N.en;
        return table[key] || I18N.en[key] || key;
      };

      const patterns = normalizePatterns(coerceDomainList(cfg.domains, DEFAULT_DOMAINS));
      if (!urlMatches(location.href, patterns)) return;

      let bookmarkIds = new Set();
      let bookmarksCache = [];
      let lastNonBookmarksPath = sessionStorage.getItem("ksBookmarksLastPath");
      let bookmarksSearch = "";

      function bookmarkKeyFromFields(username, text) {
        const safeUser = (username || "Unknown").trim();
        const safeText = (text || "").trim();
        return `${safeUser}|${safeText}`;
      }


      function loadBookmarks(callback) {
        chrome.storage.local.get({ [BOOKMARKS_KEY]: [] }, (stored) => {
          const list = stored[BOOKMARKS_KEY] || [];
          const unique = [];
          const seen = new Set();
          const indexById = new Map();
          for (const item of list) {
            if (!item) continue;
            const key = bookmarkKeyFromFields(item.username, item.text);
            const stableId = hashString(key);
            if (seen.has(stableId)) {
              const existingIndex = indexById.get(stableId);
              if (existingIndex !== undefined) {
                const existing = unique[existingIndex];
                if (!existing.avatar && item.avatar) {
                  existing.avatar = item.avatar;
                }
                if (!existing.time && item.time) {
                  existing.time = item.time;
                }
                if (!existing.profileUrl && item.profileUrl) {
                  existing.profileUrl = item.profileUrl;
                }
                if (!existing.userId && item.userId) {
                  existing.userId = item.userId;
                }
              }
              continue;
            }
            seen.add(stableId);
            indexById.set(stableId, unique.length);
            const derivedProfileUrl =
              item.profileUrl ||
              (item.userId ? `/user/${item.userId}` : "");
            unique.push({
              ...item,
              profileUrl: derivedProfileUrl,
              id: stableId
            });
          }
          if (unique.length !== list.length) {
            saveBookmarks(unique);
          }
          bookmarksCache = unique;
          bookmarkIds = new Set(unique.map((item) => item.id));
          if (callback) callback(unique);
        });
      }

      function saveBookmarks(list, callback) {
        chrome.storage.local.set({ [BOOKMARKS_KEY]: list }, () => {
          bookmarksCache = list;
          bookmarkIds = new Set(list.map((item) => item.id));
          if (callback) callback();
        });
      }

      function buildBookmarkFromCard(card) {
        const usernameEl = card.querySelector(USERNAME_SELECTOR);
        const timeEl = card.querySelector("span.text-muted-foreground.text-xs, span.text-muted-foreground.text-sm");
        const quoteBlock = card.querySelector("div.border.border-border.p-3.bg-muted.rounded-md");
        const textEl = (() => {
          const textNodes = Array.from(card.querySelectorAll(POST_TEXT_SELECTOR));
          if (!textNodes.length) return null;
          if (!quoteBlock) return textNodes[0];
          return textNodes.find((node) => !quoteBlock.contains(node)) || textNodes[0];
        })();
        const avatarImg =
          card.querySelector("img[data-slot='avatar-image']") ||
          card.querySelector("span[data-slot='avatar'] img");
        const usernameAnchor = usernameEl ? usernameEl.closest("a[href*='/user/'], a[href*='/users/'], a[href*='/profile/']") : null;
        const avatarAnchor = avatarImg ? avatarImg.closest("a[href*='/user/'], a[href*='/users/'], a[href*='/profile/']") : null;
        const profileAnchor =
          usernameAnchor ||
          avatarAnchor ||
          card.querySelector("a[href*='/user/']") ||
          card.querySelector("a[href*='/users/']") ||
          card.querySelector("a[href*='/profile/']");
        const userId =
          (usernameEl && (usernameEl.dataset.userId || usernameEl.dataset.userid || usernameEl.getAttribute("data-user-id") || usernameEl.getAttribute("data-userid"))) ||
          (avatarImg && (avatarImg.dataset.userId || avatarImg.dataset.userid || avatarImg.getAttribute("data-user-id") || avatarImg.getAttribute("data-userid"))) ||
          card.getAttribute("data-user-id") ||
          card.getAttribute("data-userid") ||
          card.dataset.userId ||
          card.dataset.userid ||
          "";
        const username = usernameEl ? (usernameEl.textContent || "").trim() : "Unknown";
        const time = timeEl ? (timeEl.textContent || "").trim() : "";
        const text = textEl ? stripTranslateLinkText(textEl.innerText || "") : "";
        const avatar = avatarImg ? (avatarImg.getAttribute("src") || "") : "";
        const profileUrl = profileAnchor ? (profileAnchor.getAttribute("href") || "") : (userId ? `/user/${userId}` : "");
        const repostUsernameEl = quoteBlock
          ? quoteBlock.querySelector("span.font-bold.text-foreground.text-base, span.font-bold.text-foreground.text-sm")
          : null;
        const repostTextEl = quoteBlock ? quoteBlock.querySelector(POST_TEXT_SELECTOR) : null;
        const repostAvatarImg =
          (quoteBlock && (quoteBlock.querySelector("img[data-slot='avatar-image']") || quoteBlock.querySelector("span[data-slot='avatar'] img"))) ||
          null;
        const repostUsernameAnchor = repostUsernameEl
          ? repostUsernameEl.closest("a[href*='/user/'], a[href*='/users/'], a[href*='/profile/']")
          : null;
        const repostAvatarAnchor = repostAvatarImg
          ? repostAvatarImg.closest("a[href*='/user/'], a[href*='/users/'], a[href*='/profile/']")
          : null;
        const repostProfileAnchor =
          repostUsernameAnchor ||
          repostAvatarAnchor ||
          (quoteBlock && (quoteBlock.querySelector("a[href*='/user/']") || quoteBlock.querySelector("a[href*='/users/']") || quoteBlock.querySelector("a[href*='/profile/']"))) ||
          null;
        const repostUsername = repostUsernameEl ? (repostUsernameEl.textContent || "").trim() : "";
        const repostText = repostTextEl ? stripTranslateLinkText(repostTextEl.innerText || "") : "";
        const repostAvatar = repostAvatarImg ? (repostAvatarImg.getAttribute("src") || "") : "";
        const repostProfileUrl = repostProfileAnchor ? (repostProfileAnchor.getAttribute("href") || "") : "";
        const actionBar =
          card.querySelector("div.flex.items-center.justify-between.mt-3.w-full") ||
          card.querySelector("div.flex.items-center.justify-between.mt-3") ||
          null;
        const getActionCount = (iconClass) => {
          const icon = actionBar ? actionBar.querySelector(`svg.${iconClass}`) : null;
          const button = icon ? icon.closest("button") : null;
          const countEl = button ? button.querySelector("span") : null;
          const raw = countEl ? (countEl.textContent || "").trim() : "";
          const parsed = parseInt(raw, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const getActionActive = (iconClass, activeClass) => {
          const icon = actionBar ? actionBar.querySelector(`svg.${iconClass}`) : null;
          const button = icon ? icon.closest("button") : null;
          if (!button) return false;
          return button.classList.contains(activeClass);
        };
        const dataId =
          card.getAttribute("data-post-id") ||
          card.getAttribute("data-id") ||
          card.dataset.postId ||
          card.dataset.id ||
          "";
        const idSource = dataId || bookmarkKeyFromFields(username, text);
        return {
          id: hashString(idSource),
          username,
          time,
          text,
          avatar,
          profileUrl,
          userId,
          repostUsername,
          repostText,
          repostAvatar,
          repostProfileUrl,
          commentCount: getActionCount("lucide-message-circle"),
          quoteCount: getActionCount("lucide-message-square-quote"),
          likeCount: getActionCount("lucide-thumbs-up"),
          dislikeCount: getActionCount("lucide-thumbs-down"),
          likeActive: getActionActive("lucide-thumbs-up", "text-success"),
          dislikeActive: getActionActive("lucide-thumbs-down", "text-destructive")
        };
      }

      function addBookmark(bookmark, button) {
        loadBookmarks((list) => {
          if (list.some((item) => item.id === bookmark.id)) return;
          const next = [bookmark, ...list].slice(0, 200);
          saveBookmarks(next, () => {
            if (button) {
              setBookmarkButtonState(button, true);
            }
          });
        });
      }

      function removeBookmarkById(id, callback) {
        loadBookmarks((list) => {
          const next = list.filter((item) => item.id !== id);
          saveBookmarks(next, () => {
            if (callback) callback(next);
          });
        });
      }

      function createBookmarkButton(card, actionBar) {
        if (actionBar.querySelector(`.${BOOKMARK_BUTTON_CLASS}`)) return;
        const bookmark = buildBookmarkFromCard(card);
        card.dataset.ksBookmarkCardId = bookmark.id;
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-ks-bookmark-id", bookmark.id);
        button.className = `${BOOKMARK_BUTTON_CLASS} items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 text-muted-foreground hover:text-info p-1 sm:p-2 flex-1 flex justify-center min-w-0`;
        button.innerHTML = `
          <div class="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span class="text-xs sm:text-sm" data-ks-bookmark-label>Bookmark</span>
        `;
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (bookmarkIds.has(bookmark.id)) {
            removeBookmarkById(bookmark.id, () => {
              setBookmarkButtonState(button, false);
            });
          } else {
            let enriched = bookmark;
            if (!bookmark.userId && !bookmark.profileUrl) {
              const details = await fetchUserDetailsFromCard(card);
              if (details && details.publicKey) {
                enriched = {
                  ...bookmark,
                  userId: details.publicKey,
                  profileUrl: `/user/${details.publicKey}`
                };
              }
            }
            addBookmark(enriched, button);
          }
        });
        setBookmarkButtonState(button, bookmarkIds.has(bookmark.id));
        const buttons = Array.from(actionBar.querySelectorAll("button"));
        const anchor = buttons[buttons.length - 1];
        if (anchor && anchor.parentElement === actionBar) {
          anchor.insertAdjacentElement("afterend", button);
        } else {
          actionBar.appendChild(button);
        }
      }

      function setBookmarkButtonState(button, isBookmarked) {
        if (isBookmarked) {
          button.classList.add("text-success");
          button.classList.remove("text-muted-foreground");
        } else {
          button.classList.remove("text-success");
          button.classList.add("text-muted-foreground");
        }
        const label = button.querySelector("[data-ks-bookmark-label]");
        if (label) {
          label.textContent = isBookmarked ? "Bookmarked" : "Bookmark";
        }
      }

      function refreshBookmarkButtons() {
        document.querySelectorAll(`.${BOOKMARK_BUTTON_CLASS}`).forEach((button) => {
          const id = button.getAttribute("data-ks-bookmark-id");
          if (!id) return;
          setBookmarkButtonState(button, bookmarkIds.has(id));
        });
      }

      function enhanceBookmarkButtons() {
        if (!cfg.bookmarksEnabled) {
          document.querySelectorAll(`.${BOOKMARK_BUTTON_CLASS}`).forEach((button) => button.remove());
          return;
        }
        document.querySelectorAll(POST_CARD_SELECTOR).forEach((card) => {
          if (card.closest(`#${BOOKMARKS_VIEW_ID}`)) return;
          const actionBar = card.querySelector("div.flex.items-center.justify-between.mt-3.w-full");
          if (!actionBar) return;
          createBookmarkButton(card, actionBar);
        });
        refreshBookmarkButtons();
        backfillBookmarksFromCards();
      }

      function backfillBookmarksFromCards() {
        loadBookmarks((list) => {
          if (!list.length) return;
          const byId = new Map(list.map((item) => [item.id, item]));
          let changed = false;
          document.querySelectorAll(POST_CARD_SELECTOR).forEach((card) => {
            if (card.closest(`#${BOOKMARKS_VIEW_ID}`)) return;
            const candidate = buildBookmarkFromCard(card);
            const existing = byId.get(candidate.id);
            if (!existing) return;
            if (!existing.userId && candidate.userId) {
              existing.userId = candidate.userId;
              changed = true;
            }
            if (!existing.profileUrl && candidate.profileUrl) {
              existing.profileUrl = candidate.profileUrl;
              changed = true;
            }
            if (!existing.avatar && candidate.avatar) {
              existing.avatar = candidate.avatar;
              changed = true;
            }
          });
          if (changed) {
            saveBookmarks(list);
          }
        });
      }

      function getBookmarksHost() {
        return document.querySelector("div.flex-1.w-full.max-w-3xl.mx-auto");
      }

      function getOrCreateBookmarksHost() {
        let host = document.querySelector("div.flex-1.w-full.max-w-3xl.mx-auto");
        if (host) return host;
        const mainColumn =
          document.querySelector("div.flex-1.transition-all.duration-300.ease-in-out") ||
          document.querySelector("div.flex-1.transition-all");
        if (!mainColumn) return null;
        const container = mainColumn.querySelector("div.h-full") || mainColumn;
        host = document.createElement("div");
        host.className = "flex-1 w-full max-w-3xl mx-auto lg:border-r border-border flex flex-col h-full";
        container.appendChild(host);
        return host;
      }

      function findPostCardByBookmarkId(bookmarkId) {
        if (!bookmarkId) return null;
        const direct = document.querySelector(`[data-ks-bookmark-card-id="${bookmarkId}"]`);
        if (direct) return direct;
        const cards = Array.from(document.querySelectorAll(POST_CARD_SELECTOR));
        for (const card of cards) {
          if (card.closest(`#${BOOKMARKS_VIEW_ID}`)) continue;
          const candidate = buildBookmarkFromCard(card);
          if (candidate.id === bookmarkId) {
            card.dataset.ksBookmarkCardId = candidate.id;
            return card;
          }
        }
        return null;
      }

      function triggerActionOnCard(card, action) {
        const iconClassMap = {
          comment: "lucide-message-circle",
          quote: "lucide-message-square-quote",
          like: "lucide-thumbs-up",
          dislike: "lucide-thumbs-down"
        };
        const iconClass = iconClassMap[action];
        if (!iconClass) return false;
        const button = card.querySelector(`svg.${iconClass}`)?.closest("button");
        if (!button) return false;
        button.click();
        return true;
      }

      function triggerBookmarkAction(bookmarkId, action, fallbackUrl) {
        if (action === "comment") return false;
        const card = findPostCardByBookmarkId(bookmarkId);
        if (card && triggerActionOnCard(card, action)) return true;
        return false;
      }

      function getActionButtonByIcon(root, iconClass) {
        return root.querySelector(`svg.${iconClass}`)?.closest("button") || null;
      }

      function syncBookmarkItemFromCard(bookmarkId) {
        if (!bookmarkId) return;
        const viewItem = document.querySelector(`[data-ks-bookmark-item][data-ks-bookmark-id="${bookmarkId}"]`);
        if (!viewItem) return;
        const card = findPostCardByBookmarkId(bookmarkId);
        if (!card) return;
        const viewButtons = {
          comment: viewItem.querySelector('button[data-ks-bookmark-action="comment"]'),
          quote: viewItem.querySelector('button[data-ks-bookmark-action="quote"]'),
          like: viewItem.querySelector('button[data-ks-bookmark-action="like"]'),
          dislike: viewItem.querySelector('button[data-ks-bookmark-action="dislike"]')
        };
        const cardButtons = {
          comment: getActionButtonByIcon(card, "lucide-message-circle"),
          quote: getActionButtonByIcon(card, "lucide-message-square-quote"),
          like: getActionButtonByIcon(card, "lucide-thumbs-up"),
          dislike: getActionButtonByIcon(card, "lucide-thumbs-down")
        };
        ["comment", "quote", "like", "dislike"].forEach((key) => {
          const viewButton = viewButtons[key];
          const cardButton = cardButtons[key];
          if (!viewButton || !cardButton) return;
          viewButton.className = cardButton.className;
          viewButton.disabled = cardButton.disabled;
          const viewCount = viewButton.querySelector("span");
          const cardCount = cardButton.querySelector("span");
          if (viewCount && cardCount) {
            viewCount.textContent = (cardCount.textContent || "").trim();
          }
          const viewIcon = viewButton.querySelector("svg");
          const cardIcon = cardButton.querySelector("svg");
          if (viewIcon && cardIcon) {
            viewIcon.setAttribute("class", cardIcon.getAttribute("class") || viewIcon.getAttribute("class") || "");
          }
        });
      }


      function renderBookmarksView(list) {
        const host = getOrCreateBookmarksHost();
        if (!host) return;

        let view = document.getElementById(BOOKMARKS_VIEW_ID);
        if (!view) {
          view = document.createElement("div");
          view.id = BOOKMARKS_VIEW_ID;
        }
        view.className = "flex-1 w-full max-w-3xl mx-auto lg:border-r border-border flex flex-col h-full";
        view.style.height = "100%";
        view.style.minHeight = "0";
        view.style.pointerEvents = "auto";
        view.style.position = "relative";
        view.style.zIndex = "20";
        view.dataset.ksBookmarksActive = "true";
        const mainColumn =
          document.querySelector("div.flex-1.transition-all.duration-300.ease-in-out") ||
          document.querySelector("div.flex-1.transition-all");
        const container = (mainColumn && (mainColumn.querySelector("div.h-full") || mainColumn)) || host.parentElement;
        if (container && view.parentElement !== container) {
          container.appendChild(view);
        }
        if (mainColumn instanceof HTMLElement) {
          mainColumn.style.pointerEvents = "auto";
          mainColumn.style.position = "relative";
          mainColumn.style.zIndex = "10";
        }
        if (container instanceof HTMLElement) {
          container.style.pointerEvents = "auto";
          container.style.position = "relative";
          container.style.zIndex = "10";
        }

        const itemsHtml = list.length
          ? list.map((item) => `
              <div class="border-b border-border sm:border-l sm:border-r p-3 sm:p-4 hover:bg-accent hover:bg-opacity-50 cursor-pointer transition-colors duration-200 bg-card" data-ks-bookmark-item="true" data-ks-bookmark-id="${escapeHtml(item.id)}" data-ks-bookmark-url="" data-ks-bookmark-text="${escapeHtml(`${(item.username || "").toLowerCase()} ${(item.text || "").toLowerCase()} ${(item.repostUsername || "").toLowerCase()} ${(item.repostText || "").toLowerCase()}`.trim())}">
                <div class="flex space-x-2 sm:space-x-3">
                  <span data-slot="avatar" class="relative flex size-8 shrink-0 overflow-hidden rounded-full h-10 w-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                    ${item.avatar ? `<img data-slot="avatar-image" class="aspect-square size-full" src="${escapeHtml(item.avatar)}" alt="">` : ""}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
                        ${
                          (item.profileUrl || item.userId)
                            ? `<a class="font-bold text-foreground truncate hover:underline cursor-pointer text-base" href="${escapeHtml(resolveHref(item.profileUrl || `/user/${item.userId}`))}">${escapeHtml(item.username)}</a>`
                            : `<span class="font-bold text-foreground truncate hover:underline cursor-pointer text-base">${escapeHtml(item.username)}</span>`
                        }
                      </div>
                      <span class="text-muted-foreground text-xs sm:text-sm flex-shrink-0 ml-2">${escapeHtml(item.time)}</span>
                    </div>
                    <div class="mt-1 text-foreground text-base break-words whitespace-pre-wrap"><span>${escapeHtml(stripTranslateLinkText(item.text))}</span></div>
                    ${
                      item.repostText || item.repostUsername || item.repostAvatar
                        ? `
                          <div class="mt-3">
                            <div class="border border-border p-3 bg-muted rounded-md transition-colors cursor-pointer hover:bg-accent hover:bg-opacity-30">
                              <div class="flex space-x-2">
                                <span data-slot="avatar" class="relative flex size-8 shrink-0 overflow-hidden rounded-full h-8 w-8 flex-shrink-0">
                                  ${item.repostAvatar ? `<img data-slot="avatar-image" class="aspect-square size-full" src="${escapeHtml(item.repostAvatar)}" alt="">` : ""}
                                </span>
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-center space-x-1">
                                    ${
                                      item.repostProfileUrl
                                        ? `<a class="font-bold text-foreground text-sm truncate hover:underline cursor-pointer" href="${escapeHtml(resolveHref(item.repostProfileUrl))}">${escapeHtml(item.repostUsername || "User")}</a>`
                                        : `<span class="font-bold text-foreground text-sm truncate">${escapeHtml(item.repostUsername || "User")}</span>`
                                    }
                                  </div>
                                  <div class="mt-1 text-foreground text-sm break-words whitespace-pre-wrap"><span>${escapeHtml(stripTranslateLinkText(item.repostText || ""))}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        `
                        : ""
                    }
                    <div class="flex items-center justify-between mt-3 w-full">
                      <button data-slot="button" data-ks-bookmark-action="comment" data-ks-bookmark-ref="${escapeHtml(item.id)}" class="items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 text-muted-foreground hover:text-info p-1 sm:p-2 flex-1 flex justify-center min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle h-3 w-3 sm:h-4 sm:w-4 mr-1" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg>
                        <span class="text-xs sm:text-sm">${escapeHtml(String(item.commentCount || 0))}</span>
                      </button>
                      <button data-slot="button" data-ks-bookmark-action="quote" data-ks-bookmark-ref="${escapeHtml(item.id)}" class="items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 text-muted-foreground hover:text-info p-1 sm:p-2 flex-1 flex justify-center min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-quote h-3 w-3 sm:h-4 sm:w-4 mr-1" aria-hidden="true"><path d="M14 14a2 2 0 0 0 2-2V8h-2"></path><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path><path d="M8 14a2 2 0 0 0 2-2V8H8"></path></svg>
                        <span class="text-xs sm:text-sm">${escapeHtml(String(item.quoteCount || 0))}</span>
                      </button>
                      <button data-slot="button" data-ks-bookmark-action="like" data-ks-bookmark-ref="${escapeHtml(item.id)}" ${item.likeActive ? "disabled" : ""} class="items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 p-1 sm:p-2 flex-1 flex justify-center min-w-0 ${item.likeActive ? "text-success" : "text-muted-foreground hover:text-success"}">
                        <div class="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thumbs-up h-3 w-3 sm:h-4 sm:w-4 ${item.likeActive ? "fill-current" : ""}" aria-hidden="true"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path></svg>
                        </div>
                        <span class="text-xs sm:text-sm">${escapeHtml(String(item.likeCount || 0))}</span>
                      </button>
                      <button data-slot="button" data-ks-bookmark-action="dislike" data-ks-bookmark-ref="${escapeHtml(item.id)}" ${item.dislikeActive ? "disabled" : ""} class="items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 p-1 sm:p-2 flex-1 flex justify-center min-w-0 ${item.dislikeActive ? "text-destructive" : "text-muted-foreground hover:text-destructive"}">
                        <div class="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thumbs-down h-3 w-3 sm:h-4 sm:w-4 ${item.dislikeActive ? "fill-current" : ""}" aria-hidden="true"><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"></path></svg>
                        </div>
                        <span class="text-xs sm:text-sm">${escapeHtml(String(item.dislikeCount || 0))}</span>
                      </button>
                      <button data-slot="button" data-ks-bookmark-id="${escapeHtml(item.id)}" class="${BOOKMARK_BUTTON_CLASS} items-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent dark:hover:bg-accent/50 h-8 rounded-md gap-1.5 has-[&>svg]:px-2.5 text-muted-foreground hover:text-info p-1 sm:p-2 flex-1 flex justify-center min-w-0">
                        <div class="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex items-center justify-center flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                        </div>
                        <span class="text-xs sm:text-sm" data-ks-bookmark-label>Bookmark</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `).join("")
          : `<div class="p-4 text-muted-foreground">No bookmarks yet.</div>`;

        view.innerHTML = `
          <div class="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border p-4 z-10">
            <div class="flex items-center space-x-4">
              <button data-slot="button" id="ks-bookmarks-back" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:text-accent-foreground dark:hover:bg-accent/50 h-8 gap-1.5 has-[&>svg]:px-2.5 p-2 hover:bg-accent rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left h-5 w-5" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
              </button>
              <h1 class="text-xl font-bold">Bookmarks</h1>
            </div>
            <div class="mt-3">
              <input id="ks-bookmarks-search" type="text" placeholder="Search bookmarks" class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-background px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive text-sm border-input-thin focus-visible:border-input-thin-focus focus-visible:ring-0" value="${escapeHtml(bookmarksSearch)}">
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-y-scroll" style="scrollbar-width: none;">
            ${itemsHtml}
          </div>
        `;

        const backButton = view.querySelector("#ks-bookmarks-back");
        backButton?.addEventListener("click", () => navigateFromBookmarks());
        const searchInput = view.querySelector("#ks-bookmarks-search");
        if (searchInput instanceof HTMLInputElement) {
          searchInput.value = bookmarksSearch;
          searchInput.addEventListener("input", () => {
            bookmarksSearch = searchInput.value;
            applyBookmarksFilter(view, bookmarksSearch);
          });
        }
        const scrollArea = view.querySelector(".overflow-y-scroll");
        if (scrollArea instanceof HTMLElement) {
          scrollArea.style.pointerEvents = "auto";
          scrollArea.style.overflowY = "auto";
          scrollArea.style.webkitOverflowScrolling = "touch";
        }
        applyBookmarksFilter(view, bookmarksSearch);
        view.querySelectorAll("button[data-ks-bookmark-id]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            const id = button.getAttribute("data-ks-bookmark-id");
            if (!id) return;
            removeBookmarkById(id, (next) => {
              renderBookmarksView(next);
              toggleBookmarksView(true);
            });
          });
          if (button.classList.contains(BOOKMARK_BUTTON_CLASS)) {
            setBookmarkButtonState(button, true);
          }
        });
        view.querySelectorAll("[data-ks-bookmark-action]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const action = button.getAttribute("data-ks-bookmark-action") || "";
            const item = button.closest("[data-ks-bookmark-item]");
            const id = button.getAttribute("data-ks-bookmark-ref") || (item ? item.getAttribute("data-ks-bookmark-id") : "");
            const url = item ? item.getAttribute("data-ks-bookmark-url") : "";
            if (!id && !url) return;
            triggerBookmarkAction(id, action, url);
            if (id) {
              setTimeout(() => syncBookmarkItemFromCard(id), 150);
            }
          });
        });
        view.querySelectorAll("[data-ks-bookmark-item]").forEach((item) => {
          const id = item.getAttribute("data-ks-bookmark-id");
          if (!id) return;
          syncBookmarkItemFromCard(id);
        });
      }

      function toggleBookmarksView(show) {
        const host = getBookmarksHost();
        const view = document.getElementById(BOOKMARKS_VIEW_ID);
        if (!host || !view) return;
        host.style.display = show ? "none" : "";
        view.style.display = show ? "" : "none";
        setBookmarksNavActive(show);
      }

      function setBookmarksNavActive(active) {
        const nav = document.querySelector("nav.space-y-3");
        if (!nav) return;
        const bookmarksBtn = nav.querySelector(`#${BOOKMARKS_NAV_ID}`);
        if (!bookmarksBtn) return;
        const buttons = Array.from(nav.querySelectorAll("button"));
        if (active) {
          buttons.forEach((button) => {
            if (!button.dataset.ksBookmarksPrevClass) {
              button.dataset.ksBookmarksPrevClass = button.className;
            }
            if (button === bookmarksBtn) {
              button.classList.remove("text-muted-foreground", "font-medium");
              button.classList.add("text-foreground", "font-bold");
            } else {
              button.classList.remove("text-foreground", "font-bold");
              button.classList.add("text-muted-foreground", "font-medium");
            }
          });
          nav.dataset.ksBookmarksActive = "true";
          return;
        }
        buttons.forEach((button) => {
          const previous = button.dataset.ksBookmarksPrevClass;
          if (previous) {
            button.className = previous;
            delete button.dataset.ksBookmarksPrevClass;
          }
        });
        delete nav.dataset.ksBookmarksActive;
      }

      function applyBookmarksFilter(view, query) {
        const needle = (query || "").trim().toLowerCase();
        view.querySelectorAll("[data-ks-bookmark-item]").forEach((item) => {
          if (!(item instanceof HTMLElement)) return;
          if (!needle) {
            item.style.display = "";
            return;
          }
          const text = item.getAttribute("data-ks-bookmark-text") || "";
          item.style.display = text.includes(needle) ? "" : "none";
        });
      }

      function openBookmarksPage(attempts = 5) {
        loadBookmarks((list) => {
          const host = getOrCreateBookmarksHost();
          if (!host) {
            if (attempts > 0) {
              setTimeout(() => openBookmarksPage(attempts - 1), 300);
            }
            return;
          }
          renderBookmarksView(list);
          toggleBookmarksView(true);
        });
      }

      function navigateToBookmarks() {
        if (!cfg.bookmarksEnabled) return;
        lastNonBookmarksPath = `${location.pathname}${location.search}${location.hash}`;
        sessionStorage.setItem("ksBookmarksLastPath", lastNonBookmarksPath);
        openBookmarksPage();
      }

      function navigateFromBookmarks() {
        toggleBookmarksView(false);
      }

      function bindBookmarksNavButton(button) {
        if (!button) return;
        const handler = (event) => {
          event.preventDefault();
          event.stopPropagation();
          navigateToBookmarks();
        };
        button.onclick = handler;
        button.onpointerdown = handler;
      }

      function ensureBookmarksNav() {
        const nav = document.querySelector("nav.space-y-3");
        if (!nav) return;
        const existing = nav.querySelector(`#${BOOKMARKS_NAV_ID}`);
        if (!cfg.bookmarksEnabled) {
          existing?.remove();
          return;
        }
        if (!nav.dataset.ksBookmarksNavBound) {
          nav.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target.closest("button") : null;
            if (!target || target.id === BOOKMARKS_NAV_ID) return;
            const view = document.getElementById(BOOKMARKS_VIEW_ID);
            if (view && view.style.display !== "none") {
              toggleBookmarksView(false);
            }
          });
          nav.dataset.ksBookmarksNavBound = "true";
        }
        if (existing) {
          bindBookmarksNavButton(existing);
          return;
        }
        const followingBtn = Array.from(nav.querySelectorAll("button")).find((btn) => {
          const span = btn.querySelector("span");
          return span && (span.textContent || "").trim() === "Following";
        });
        if (!followingBtn) return;
        const button = document.createElement("button");
        button.id = BOOKMARKS_NAV_ID;
        button.setAttribute("data-slot", "button");
        button.className = "inline-flex items-center whitespace-nowrap text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:text-accent-foreground dark:hover:bg-accent/50 h-9 has-[&>svg]:px-3 w-full justify-start px-4 gap-4 py-3 text-left rounded-lg transition-all duration-300 cursor-pointer text-muted-foreground hover:bg-muted relative";
        button.innerHTML = `
          <div class="relative inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark size-5 transition-all duration-300" aria-hidden="true"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span class="text-lg sm:text-xl">Bookmarks</span>
        `;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          navigateToBookmarks();
        });
        bindBookmarksNavButton(button);
        followingBtn.insertAdjacentElement("afterend", button);
      }

      function ensureBookmarksGlobalClick() {
        if (document.body.dataset.ksBookmarksGlobalBound) return;
        const handler = (event) => {
          if (!cfg.bookmarksEnabled) return;
          const target = event.target instanceof Element ? event.target.closest(`#${BOOKMARKS_NAV_ID}`) : null;
          if (!target) return;
          event.preventDefault();
          event.stopPropagation();
          navigateToBookmarks();
        };
        document.addEventListener("click", handler, true);
        document.addEventListener("pointerdown", handler, true);
        document.body.dataset.ksBookmarksGlobalBound = "true";
      }

      // ---------- SETTINGS INJECTION ("/settings") ----------
      let currentApiKey = "";
      let currentDomains = DEFAULT_DOMAINS.slice();
      let keyVisible = false;
      const LOG_EMPTY_MESSAGE = "No entries.";
      function renderLog(entries, target) {
        if (!entries || !entries.length) {
          target.textContent = LOG_EMPTY_MESSAGE;
          return;
        }

        const lines = entries.map((e) => {
          const ts = e.ts || "";
          const level = (e.level || "info").toUpperCase();
          const msg = e.message || "";
          const details = e.details ? ` | ${e.details}` : "";
          return `${ts} [${level}] ${msg}${details}`;
        });
        target.textContent = lines.join("\n");
      }

      function normalizePatternLines(lines) {
        return lines.map(p => {
          const t = (p || "").trim();
          if (!t) return "";
          if (t.endsWith("*")) return t;
          if (t.endsWith("/")) return t + "*";
          return t;
        }).filter(Boolean);
      }

      function diffDomains(next, prev) {
        const nextSet = new Set(next);
        const prevSet = new Set(prev);
        const removed = prev.filter((d) => !nextSet.has(d));
        return { removed };
      }

      function checkMissingPermissions(domains) {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "checkMissingPermissions", domains },
            (resp) => resolve(resp && resp.missing ? resp.missing : [])
          );
        });
      }

      function setKeyVisible(visible, apiKeyEl, toggleBtn) {
        keyVisible = visible;
        apiKeyEl.type = "text";
        apiKeyEl.style.webkitTextSecurity = visible ? "none" : "disc";
        apiKeyEl.style.textSecurity = visible ? "none" : "disc";
        if (visible) {
          apiKeyEl.value = currentApiKey;
          toggleBtn.textContent = "Hide key";
        } else {
          apiKeyEl.value = currentApiKey || "";
          apiKeyEl.placeholder = "e.g. xxxx-xxxx-xxxx";
          toggleBtn.textContent = "Show key";
        }
      }

      function createSettingsCard() {
        const card = document.createElement("div");
        card.className = "bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-2 shadow-sm border border-border ks-settings-card";
        card.setAttribute("data-slot", "card");
        card.innerHTML = `
          <div data-slot="card-content" class="p-6">
            <div class="space-y-4">
              <div class="flex items-center space-x-2 mb-4">
                <img src="https://kaspa.org/wp-content/uploads/2023/06/Kaspa-Icon-White.png" alt="" class="h-5 w-5" />
                <h2 id="ks-title" class="text-lg font-semibold">K-Social Enhanced</h2>
              </div>
              <div class="space-y-3 border border-border rounded-md p-4">
                <div class="text-lg font-semibold text-foreground">Post translation tool</div>
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-foreground" for="ks-apiKey" id="ks-apiKeyLabel">DeepL API Key (<a href="https://www.deepl.com/en/pro-api" target="_blank" rel="noopener noreferrer">https://www.deepl.com/en/pro-api</a>)</label>
                  <input id="ks-apiKey" type="text" name="deepl-api-key" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="flex h-10 rounded-md border border-light bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-full" placeholder="e.g. xxxx-xxxx-xxxx" />
                  <p id="ks-apiKeyHint" class="text-xs text-muted-foreground"></p>
                </div>
                <div class="flex items-center gap-3">
                <button id="ks-toggleKey" type="button" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all h-9 rounded-md px-3 border border-border bg-background hover:bg-accent hover:text-accent-foreground">Show key</button>
                </div>
                <div class="space-y-2">
                  <label id="ks-langLabel" class="block text-sm font-medium text-foreground" for="ks-lang">Target language</label>
                  <div class="relative">
                    <select id="ks-lang" class="flex h-10 rounded-md border border-light bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none pr-8 w-full">
                    <option value="DE">German (DE)</option>
                    <option value="EN">English (EN)</option>
                    <option value="FR">French (FR)</option>
                    <option value="ES">Spanish (ES)</option>
                    <option value="IT">Italian (IT)</option>
                    <option value="NL">Dutch (NL)</option>
                    <option value="PL">Polish (PL)</option>
                  </select>
                  </div>
                </div>
              </div>
              <div class="space-y-3 border border-border rounded-md p-4">
                <div class="text-lg font-semibold text-foreground">Domains</div>
                <div class="space-y-2">
                  <label id="ks-domainsLabel" class="block text-sm font-medium text-foreground" for="ks-domains">Active domains (one per line, * allowed)</label>
                  <textarea id="ks-domains" rows="4" class="flex rounded-md border border-light bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-full font-mono"></textarea>
                  <p id="ks-domainsHint" class="text-xs text-muted-foreground">Tip: If you enter https://k-social.network/ then * is appended automatically. You will be prompted to grant access.</p>
                </div>
              </div>
              <div class="space-y-3 border border-border rounded-md p-4">
                <div class="text-lg font-semibold text-foreground">Settings</div>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-tabTitleEnabled" type="checkbox" class="h-4 w-4" />
                  <span>Browser tab notification (renames tab title)</span>
                </label>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-notificationsEnabled" type="checkbox" class="h-4 w-4" />
                  <span id="ks-notificationsLabel">System-wide notifications</span>
                </label>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-bookmarksEnabled" type="checkbox" class="h-4 w-4" />
                  <span>Enable bookmarks</span>
                </label>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-hideTransactionPopup" type="checkbox" class="h-4 w-4" />
                  <span>Hide transaction popup</span>
                </label>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-turquoiseThemeEnabled" type="checkbox" class="h-4 w-4" />
                  <span>Turquoise Kaspa Theme</span>
                </label>
                <label class="flex items-center space-x-2 text-sm">
                  <input id="ks-debugLogEnabled" type="checkbox" class="h-4 w-4" />
                  <span id="ks-debugLabel">Enable debug log</span>
                </label>
                <div class="space-y-2" id="ks-debugLogSection">
                  <label id="ks-debugTitle" class="block text-sm font-medium text-foreground" for="ks-debugLog">Debug log</label>
                  <div id="ks-debugLog" class="text-xs text-muted-foreground whitespace-pre-wrap border border-border rounded-md bg-muted p-3"></div>
                  <p id="ks-debugHint" class="text-xs text-muted-foreground">Stored locally. Last 100 entries.</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                  <button id="ks-save" type="button" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all h-9 rounded-md px-3 border border-border bg-background hover:bg-accent hover:text-accent-foreground">Save</button>
                  <button id="ks-clearLog" type="button" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all h-9 rounded-md px-3 border border-border bg-background hover:bg-accent hover:text-accent-foreground">Clear log</button>
                  <button id="ks-clearCache" type="button" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all h-9 rounded-md px-3 border border-border bg-background hover:bg-accent hover:text-accent-foreground">Clear cache</button>
                <span id="ks-status" class="text-xs text-muted-foreground"></span>
              </div>
            </div>
          </div>
        `;

        const apiKeyEl = card.querySelector("#ks-apiKey");
        const langEl = card.querySelector("#ks-lang");
        const domainsEl = card.querySelector("#ks-domains");
        const notificationsEl = card.querySelector("#ks-notificationsEnabled");
        const tabTitleEnabledEl = card.querySelector("#ks-tabTitleEnabled");
        const bookmarksEnabledEl = card.querySelector("#ks-bookmarksEnabled");
        const hideTransactionPopupEl = card.querySelector("#ks-hideTransactionPopup");
        const turquoiseThemeEnabledEl = card.querySelector("#ks-turquoiseThemeEnabled");
        const debugLogEnabledEl = card.querySelector("#ks-debugLogEnabled");
        const debugLogEl = card.querySelector("#ks-debugLog");
        const debugLogSectionEl = card.querySelector("#ks-debugLogSection");
        const toggleKeyEl = card.querySelector("#ks-toggleKey");
        const statusEl = card.querySelector("#ks-status");

        function showStatus(msg) {
          statusEl.textContent = msg;
          setTimeout(() => (statusEl.textContent = ""), 2500);
        }


        function setLogVisibility(enabled) {
          debugLogSectionEl.style.display = enabled ? "" : "none";
          card.querySelector("#ks-clearLog").style.display = enabled ? "" : "none";
        }

        function loadSettings() {
          chrome.storage.local.get(
            {
              apiKey: "",
              lang: "DE",
              domains: DEFAULT_DOMAINS,
              notificationsEnabled: false,
              tabTitleEnabled: true,
              bookmarksEnabled: true,
              hideTransactionPopup: false,
              turquoiseThemeEnabled: false,
              debugLogEnabled: false,
              debugLog: []
            },
            (loaded) => {
              currentApiKey = loaded.apiKey || "";
              if (/^\*+$/.test(currentApiKey)) {
                currentApiKey = "";
                showStatus("Please re-enter API key.");
              }
              setKeyVisible(false, apiKeyEl, toggleKeyEl);
              langEl.value = loaded.lang || "DE";
              currentDomains = normalizePatternLines(coerceDomainList(loaded.domains, DEFAULT_DOMAINS));
              domainsEl.value = currentDomains.join("\n");
              notificationsEl.checked = !!loaded.notificationsEnabled;
              tabTitleEnabledEl.checked = loaded.tabTitleEnabled !== false;
              bookmarksEnabledEl.checked = loaded.bookmarksEnabled !== false;
              hideTransactionPopupEl.checked = !!loaded.hideTransactionPopup;
              turquoiseThemeEnabledEl.checked = !!loaded.turquoiseThemeEnabled;
              debugLogEnabledEl.checked = !!loaded.debugLogEnabled;
              setLogVisibility(!!loaded.debugLogEnabled);
              renderLog(loaded.debugLog || [], debugLogEl);
            }
          );
        }

        toggleKeyEl.onclick = () => {
          if (!keyVisible) {
            const draft = apiKeyEl.value.trim();
            if (draft && !/^\*+$/.test(draft)) {
              currentApiKey = draft;
            }
          }
          setKeyVisible(!keyVisible, apiKeyEl, toggleKeyEl);
        };

        card.querySelector("#ks-save").onclick = async () => {
          const domains = normalizePatternLines(domainsEl.value.split(/\n+/));
          const prevKey = currentApiKey;
          let apiKeyValue = apiKeyEl.value.trim();
          const looksMasked = /^\*+$/.test(apiKeyValue);
          const { removed } = diffDomains(domains, currentDomains);
          const missing = await checkMissingPermissions(domains);
          if (missing.length) {
            chrome.runtime.sendMessage({ type: "openPermissions", domains, removed }, () => {
              showStatus("Please grant access in the opened tab.");
            });
          } else {
            chrome.runtime.sendMessage({ type: "permissionsGranted", domains });
          }

          const basePayload = {
            lang: langEl.value,
            domains,
            notificationsEnabled: notificationsEl.checked,
            tabTitleEnabled: tabTitleEnabledEl.checked,
            bookmarksEnabled: bookmarksEnabledEl.checked,
            hideTransactionPopup: hideTransactionPopupEl.checked,
            turquoiseThemeEnabled: turquoiseThemeEnabledEl.checked,
            debugLogEnabled: debugLogEnabledEl.checked
          };

          if (!keyVisible && (!apiKeyValue || looksMasked)) {
            apiKeyValue = prevKey;
          }

          if (apiKeyValue) {
            currentApiKey = apiKeyValue;
          } else {
            currentApiKey = "";
          }

          chrome.storage.local.set(
            {
              ...basePayload,
              apiKey: currentApiKey
            },
            () => {
              showStatus("Saved ✔");
              addDebugLog("info", "Settings saved");
              if (currentApiKey && currentApiKey !== prevKey) {
                addDebugLog("info", "API key updated");
              }
              setKeyVisible(false, apiKeyEl, toggleKeyEl);
              currentDomains = domains;
            }
          );
        };

        card.querySelector("#ks-clearLog").onclick = () => {
          chrome.storage.local.set({ debugLog: [] }, () => {
            renderLog([], debugLogEl);
            showStatus("Log cleared ✔");
          });
        };

        card.querySelector("#ks-clearCache").onclick = () => {
          chrome.storage.local.clear(() => {
            showStatus("Cache cleared ✔");
            location.reload();
          });
        };

        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local") return;
          if (changes.debugLog) {
            renderLog(changes.debugLog.newValue || [], debugLogEl);
          }
          if (changes.debugLogEnabled) {
            debugLogEnabledEl.checked = !!changes.debugLogEnabled.newValue;
            setLogVisibility(!!changes.debugLogEnabled.newValue);
          }
          if (changes.lang) {
            currentLocale = localeFromLang(changes.lang.newValue);
            addDebugLog("info", "Target language changed", `lang=${changes.lang.newValue}`);
          }
          if (changes.notificationsEnabled) {
            notificationsEl.checked = !!changes.notificationsEnabled.newValue;
          }
          if (changes.tabTitleEnabled) {
            tabTitleEnabledEl.checked = changes.tabTitleEnabled.newValue !== false;
          }
          if (changes.bookmarksEnabled) {
            bookmarksEnabledEl.checked = changes.bookmarksEnabled.newValue !== false;
          }
          if (changes.hideTransactionPopup) {
            hideTransactionPopupEl.checked = !!changes.hideTransactionPopup.newValue;
          }
          if (changes.turquoiseThemeEnabled) {
            turquoiseThemeEnabledEl.checked = !!changes.turquoiseThemeEnabled.newValue;
          }
          if (changes.apiKey) {
            currentApiKey = changes.apiKey.newValue || "";
            if (keyVisible) {
              apiKeyEl.value = currentApiKey;
            } else {
              setKeyVisible(false, apiKeyEl, toggleKeyEl);
            }
          }
        });

        loadSettings();
        return card;
      }

      function ensureSettingsInjected() {
        if (!isSettingsPage()) return;
        if (document.querySelector(".ks-settings-card")) return;
        const container = document.querySelector(".max-w-2xl.mx-auto.space-y-6");
        if (!container) return;
        container.prepend(createSettingsCard());
      }

      function ensureTurquoiseHoverStyle() {
        if (document.getElementById(TURQUOISE_HOVER_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = TURQUOISE_HOVER_STYLE_ID;
        style.textContent = `
          a {
            color: #70C7BA !important;
          }
          #ks-bookmarks-view a,
          #ks-bookmarks-view a * {
            color: inherit !important;
          }
          nav.space-y-3 button:hover,
          nav.space-y-3 button:hover *,
          nav.space-y-3 a:hover,
          nav.space-y-3 a:hover * {
            color: #70C7BA !important;
          }
          .hover\\:bg-accent:hover .text-foreground,
          .hover\\:bg-accent:hover .text-foreground * {
            color: #70C7BA !important;
          }
          .hover\\:bg-accent:hover a {
            color: #70C7BA !important;
          }
          #ks-bookmarks-view .hover\\:bg-accent:hover a,
          #ks-bookmarks-view .hover\\:bg-accent:hover a * {
            color: #70C7BA !important;
          }
        `;
        document.head.appendChild(style);
      }

      function applyTurquoiseHoverTheme(enabled) {
        if (enabled) {
          ensureTurquoiseHoverStyle();
          tintTurquoiseLogo(true);
          return;
        }
        const style = document.getElementById(TURQUOISE_HOVER_STYLE_ID);
        if (style) style.remove();
        tintTurquoiseLogo(false);
      }

      function ensureTurquoiseLogoWatcher(enabled) {
        if (!enabled) {
          if (document.body.dataset.ksTurquoiseLogoWatcher && document.body.ksTurquoiseLogoObserver) {
            document.body.ksTurquoiseLogoObserver.disconnect();
            delete document.body.ksTurquoiseLogoObserver;
          }
          delete document.body.dataset.ksTurquoiseLogoWatcher;
          return;
        }
        if (document.body.dataset.ksTurquoiseLogoWatcher) return;
        const observer = new MutationObserver(() => tintTurquoiseLogo(true));
        observer.observe(document.body, { childList: true, subtree: true });
        document.body.ksTurquoiseLogoObserver = observer;
        document.body.dataset.ksTurquoiseLogoWatcher = "true";
      }

      function findLogoSvg() {
        return document.querySelector("svg.h-16.w-16") || null;
      }

      function tintTurquoiseLogo(enable) {
        const svg = findLogoSvg();
        if (!svg || !(svg instanceof SVGElement)) return false;
        if (enable) {
          if (!svg.hasAttribute(TURQUOISE_LOGO_ORIGINAL_ATTR)) {
            svg.setAttribute(TURQUOISE_LOGO_ORIGINAL_ATTR, svg.outerHTML);
          }
          svg.style.color = TURQUOISE_LOGO_COLOR;
          const targets = new Set();
          svg.querySelectorAll(".cls-3").forEach((el) => targets.add(el));
          svg.querySelectorAll("[fill=\"#ffffff\"], [fill=\"#FFFFFF\"]").forEach((el) => targets.add(el));
          if (!targets.size) {
            svg.querySelectorAll("path").forEach((el) => targets.add(el));
          }
          targets.forEach((el) => {
            el.style.setProperty("fill", TURQUOISE_LOGO_COLOR, "important");
          });
          return true;
        }
        const original = svg.getAttribute(TURQUOISE_LOGO_ORIGINAL_ATTR);
        if (original) {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = original;
          const restored = wrapper.firstElementChild;
          if (restored) {
            svg.replaceWith(restored);
            return true;
          }
        }
        return false;
      }


      const settingsObserver = new MutationObserver(() => {
        ensureSettingsInjected();
      });
      settingsObserver.observe(document.body, { childList: true, subtree: true });
      ensureSettingsInjected();

      // ---------- HIDE TRANSACTION POPUP ----------
      let transactionPopupObserver = null;
      let transactionPopupInterval = null;

      function findTransactionPopupRoot(anchor) {
        if (!(anchor instanceof Element)) return null;
        const root = anchor.closest(
          "[data-sonner-toast], [data-toast], [role='alert'], [role='status'], [aria-live], .sonner-toast, .toast, .notification, .radix-toast, .radix-toast-root"
        );
        if (!root) return null;
        if (root.closest(POST_CARD_SELECTOR)) return null;
        return root;
      }

      function findTextPopupRoot(element) {
        if (!(element instanceof Element)) return null;
        const root = element.closest(
          "[data-sonner-toast], [data-sonner-toaster], [data-toast], [role='alert'], [role='status'], [aria-live], .sonner-toast, .toast, .notification, .radix-toast, .radix-toast-root"
        );
        const candidate = root || element.closest("[class*='toast'], [class*='sonner'], [class*='notification']");
        if (!candidate) return null;
        if (candidate.closest(POST_CARD_SELECTOR)) return null;
        return candidate;
      }

      function textLooksLikeTransaction(value) {
        if (!value) return false;
        const text = String(value).toLowerCase();
        const hasTransaction = text.includes("transaction");
        const hasId = text.includes("transaction id");
        const hasFees = text.includes("fees");
        const hasExplorer = text.includes("open explorer");
        return hasId || hasExplorer || (hasTransaction && hasFees);
      }

      function getElementTextForMatch(element) {
        if (!(element instanceof Element)) return "";
        return [
          element.textContent,
          element.getAttribute("aria-label"),
          element.getAttribute("data-title"),
          element.getAttribute("data-description"),
          element.getAttribute("title")
        ].filter(Boolean).join(" ");
      }

      function scanForTransactionPopups(root) {
        const base = root instanceof Element ? root : document.body;
        if (!base) return;
        const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const text = (node.nodeValue || "").trim();
            return textLooksLikeTransaction(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        });
        let node;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (!parent) continue;
          const popup = findTextPopupRoot(parent);
          if (!popup) continue;
          popup.style.display = "none";
          popup.dataset.ksHiddenTransactionPopup = "true";
        }
      }

      function hideTransactionPopupsIn(root) {
        if (!(root instanceof Element)) return;
        const anchors = [];
        if (root.matches("a[href*='kaspa.stream/transactions/']")) {
          anchors.push(root);
        }
        root.querySelectorAll("a[href*='kaspa.stream/transactions/']").forEach((anchor) => anchors.push(anchor));
        anchors.forEach((anchor) => {
          const popup = findTransactionPopupRoot(anchor);
          if (!popup) return;
          popup.style.display = "none";
          popup.dataset.ksHiddenTransactionPopup = "true";
        });
        const textNodes = new Set();
        if (root.matches) {
          textNodes.add(root);
        }
        root.querySelectorAll("[data-sonner-toast], [data-sonner-toaster], [data-toast], [role='alert'], [role='status'], [aria-live], .sonner-toast, .toast, .notification, .radix-toast, .radix-toast-root").forEach((el) => {
          textNodes.add(el);
        });
        textNodes.forEach((node) => {
          const text = getElementTextForMatch(node);
          if (!textLooksLikeTransaction(text)) return;
          const popup = findTextPopupRoot(node);
          if (!popup) return;
          popup.style.display = "none";
          popup.dataset.ksHiddenTransactionPopup = "true";
        });
        scanForTransactionPopups(root);
      }

      function setTransactionPopupHider(enabled) {
        if (!enabled) {
          if (transactionPopupObserver) {
            transactionPopupObserver.disconnect();
            transactionPopupObserver = null;
          }
          if (transactionPopupInterval) {
            clearInterval(transactionPopupInterval);
            transactionPopupInterval = null;
          }
          return;
        }
        if (!transactionPopupObserver) {
          transactionPopupObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                hideTransactionPopupsIn(node);
              });
            });
            hideTransactionPopupsIn(document.body);
          });
          transactionPopupObserver.observe(document.body, { childList: true, subtree: true });
        }
        if (!transactionPopupInterval) {
          transactionPopupInterval = setInterval(() => {
            hideTransactionPopupsIn(document.body);
          }, 250);
        }
        hideTransactionPopupsIn(document.body);
      }

      // ---------- TAB TITLE + OPTIONAL BROWSER NOTIFICATIONS ----------
      let lastBadgeText = null;
      if (cfg.tabTitleEnabled) {
        document.title = BASE_TITLE;
      }

      const updateTabTitle = () => {
        if (!cfg.tabTitleEnabled) return;
        const badge = document.querySelector(BADGE_SELECTOR);
        const raw = badge ? (badge.textContent || "").trim() : "";
        setTitleFromCount(raw);

        // Notify only when:
        // - enabled
        // - count changed to a non-empty value
        if (cfg.notificationsEnabled) {
          if (raw && raw !== lastBadgeText) {
              if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                  type: "notify",
                  text: `New notifications: ${raw}`
                });
                addDebugLog("info", "Notification sent", `count=${raw}`);
              }
            }
          }
        lastBadgeText = raw;
      };

      new MutationObserver(updateTabTitle).observe(document.body, { childList: true, subtree: true });
      updateTabTitle();

      // ---------- DEEPL TRANSLATION ----------
      function addDebugLog(level, message, details) {
        if (!cfg.debugLogEnabled) return;
        const entry = {
          ts: new Date().toISOString(),
          level,
          message,
          details
        };

        chrome.storage.local.get({ debugLog: [] }, (stored) => {
          const next = [entry, ...((stored && stored.debugLog) || [])];
          if (next.length > 100) next.length = 100;
          chrome.storage.local.set({ debugLog: next });
        });
      }

      function requestTranslation(text, apiKey) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "translate",
              text,
              lang: cfg.lang,
              apiKey
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (!response || !response.ok) {
                reject(new Error((response && response.error) || "DeepL error."));
                return;
              }
              resolve(response.text);
            }
          );
        });
      }

      async function translateWithDeepL(text) {
        if (!cfg.apiKey) {
          throw new Error("No DeepL API key set (open options and enter it).");
        }
        return requestTranslation(text, cfg.apiKey);
      }

      function createTranslateLink(postDiv, originalText) {
        if (postDiv.querySelector(".ks-translate-link")) return null;

        const link = document.createElement("a");
        link.href = "#";
        link.textContent = t("translate_link");
        link.className = "ks-translate-link";
        link.style.cssText = "display:block; margin-top:4px; font-size:0.8em; color:#007bff; cursor:pointer;";
        link.dataset.state = "idle";

        link.onclick = async (e) => {
          e.preventDefault();
          if (link.dataset.translating) return;

          link.dataset.translating = "1";
          link.dataset.state = "translating";
          link.textContent = t("translating");

          try {
            addDebugLog("info", "Translation started", `len=${originalText.length}`);
            const translation = await translateWithDeepL(originalText);

            if (!postDiv.querySelector(".ks-translation")) {
              const div = document.createElement("div");
              div.className = "ks-translation";
              div.textContent = translation;
              div.style.cssText = "margin-top:6px; padding-left:6px; border-left:2px solid #888; font-style:italic;";
              postDiv.appendChild(div);
            }

            link.dataset.state = "translated";
            link.textContent = t("translated");
            addDebugLog("info", "Translation successful", `len=${originalText.length}`);
          } catch (err) {
            console.error("DeepL fehlgeschlagen:", err);
            link.dataset.state = "error";
            link.textContent = t("translate_error");
            const errMsg = err && err.message ? err.message : String(err);
            addDebugLog(
              "error",
              "Translation failed",
              `url=${location.href} | len=${originalText.length} | ${errMsg}`
            );
          } finally {
            // allow re-try if needed
            delete link.dataset.translating;
          }
        };

        return link;
      }

      function enhancePosts() {
        if (!cfg.apiKey) return;
        document.querySelectorAll(POST_TEXT_SELECTOR).forEach(postDiv => {
          if (postDiv.querySelector(".ks-translate-link")) return;

          const topSpans = Array.from(postDiv.children).filter(c => c.tagName === "SPAN");
          if (!topSpans.length) return;

          const text = topSpans.map(s => (s.innerText || "").trim()).join("\n");
          if (!text) return;

          const link = createTranslateLink(postDiv, text);
          if (link) postDiv.appendChild(link);
        });
      }

      function enhanceBookmarks() {
        ensureBookmarksNav();
        ensureBookmarksGlobalClick();
        loadBookmarks(() => {
          enhanceBookmarkButtons();
        });
      }

      new MutationObserver(() => {
        enhancePosts();
        enhanceBookmarks();
      }).observe(document.body, { childList: true, subtree: true });
      enhancePosts();
      enhanceBookmarks();
      setTransactionPopupHider(!!cfg.hideTransactionPopup);
      applyTurquoiseHoverTheme(!!cfg.turquoiseThemeEnabled);
      ensureTurquoiseLogoWatcher(!!cfg.turquoiseThemeEnabled);

      // If options change while tab open, re-read config
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        // Simple approach: reload page so new settings apply cleanly
        if (changes.lang) {
          addDebugLog("info", "Target language changed", `lang=${changes.lang.newValue}`);
        }
        if (changes[BOOKMARKS_KEY]) {
          const list = changes[BOOKMARKS_KEY].newValue || [];
          bookmarkIds = new Set(list.map((item) => item.id));
          const view = document.getElementById(BOOKMARKS_VIEW_ID);
          if (view && view.style.display !== "none") {
            renderBookmarksView(list);
            toggleBookmarksView(true);
          }
          refreshBookmarkButtons();
        }
        if (changes.bookmarksEnabled) {
          cfg.bookmarksEnabled = changes.bookmarksEnabled.newValue !== false;
          enhanceBookmarks();
          if (!cfg.bookmarksEnabled) {
            navigateFromBookmarks();
          }
        }
        if (changes.hideTransactionPopup) {
          cfg.hideTransactionPopup = !!changes.hideTransactionPopup.newValue;
          setTransactionPopupHider(cfg.hideTransactionPopup);
        }
        if (changes.turquoiseThemeEnabled) {
          cfg.turquoiseThemeEnabled = !!changes.turquoiseThemeEnabled.newValue;
          applyTurquoiseHoverTheme(cfg.turquoiseThemeEnabled);
          ensureTurquoiseLogoWatcher(cfg.turquoiseThemeEnabled);
        }
        if (changes.apiKey || changes.lang || changes.domains || changes.notificationsEnabled || changes.tabTitleEnabled || changes.debugLogEnabled) {
          location.reload();
        }
      });
    }
  );
})();
