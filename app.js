/* مكتبتي — منطق إدارة المكتبة الشخصية (localStorage + Supabase اختياري) */
(function () {
  "use strict";

  var STORAGE_KEY = "maktabati_books_v1";

  var STATUS_LABELS = {
    todo: "لم أبدأ",
    reading: "أقرأ حاليًا",
    done: "انتهيت"
  };

  var SUPABASE_URL = "https://wqnjgafauzyasdsodcfu.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_ROVBt99i2C1fDAauZaW5ow_vBQFoYzk";
  var isSupabaseActive = false;
  var userId = null;
  var currentUser = null;
  var supabase = null;
  var supabaseMode = false;

  // ---------- SEED books ----------
  var SEED_BOOKS = [
    { id: uid(), title: "مقدمة ابن خلدون", author: "ابن خلدون", category: "تاريخ", status: "done", pages: 600, year: 1377, rating: 5, notes: "تأسيس علم العمران، قراءة ممتعة وعميقة.", createdAt: Date.now() - 9 },
    { id: uid(), title: "خواطر شاب", author: "أحمد الشقيري", category: "تطوير الذات", status: "reading", pages: 220, year: 2015, rating: 4, notes: "أقرأ فصلًا كل مساء، أفكار عملية عن الإحسان.", createdAt: Date.now() - 8 },
    { id: uid(), title: "في ظلال القرآن", author: "سيد قطب", category: "ديني", status: "reading", pages: 1200, year: 1952, rating: 5, notes: "أتدبر جزءًا منه أسبوعيًا.", createdAt: Date.now() - 7 },
    { id: uid(), title: "موسم الهجرة إلى الشمال", author: "الطيب صالح", category: "رواية", status: "done", pages: 168, year: 1966, rating: 5, notes: "من أعظم الروايات العربية.", createdAt: Date.now() - 6 },
    { id: uid(), title: "العادات الذرية", author: "جيمس كلير", category: "تطوير الذات", status: "todo", pages: 320, year: 2018, rating: 0, notes: "على قائمة القراءة لهذا الشهر.", createdAt: Date.now() - 5 },
    { id: uid(), title: "أولاد حارتنا", author: "نجيب محفوظ", category: "رواية", status: "todo", pages: 560, year: 1959, rating: 0, notes: "", createdAt: Date.now() - 4 },
    { id: uid(), title: "الكون الأنيق", author: "براين غرين", category: "علوم", status: "reading", pages: 450, year: 1999, rating: 4, notes: "فيزياء مبسطة بأسلوب شيق.", createdAt: Date.now() - 3 },
    { id: uid(), title: "طبائع الاستبداد", author: "عبد الرحمن الكواكبي", category: "فكر", status: "done", pages: 190, year: 1902, rating: 4, notes: "نص مؤسس في الفكر السياسي العربي.", createdAt: Date.now() - 2 }
  ];

  // ---------- الحالة ----------
  var books = loadBooks();
  var deleteTargetId = null;
  var currentRating = 0;
  var supabaseMode = false;

  // ---------- عناصر DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var grid = $("booksGrid");
  var emptyState = $("emptyState");
  var resultCount = $("resultCount");
  var searchInput = $("searchInput");
  var categoryFilter = $("categoryFilter");
  var statusFilter = $("statusFilter");
  var sortSelect = $("sortSelect");
  var bookModal = $("bookModal");
  var deleteModal = $("deleteModal");
  var bookForm = $("bookForm");
  var formError = $("formError");
  var loginScreen = $("loginScreen");
  var loginForm = $("loginForm");
  var loginError = $("loginError");
  var logoutBtn = $("logoutBtn");

  // ---------- التخزين ----------
  function uid() {
    return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function loadBooks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* تجاهل */ }
    // أول تشغيل: البيانات التجريبية
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BOOKS)); } catch (e) {}
    return SEED_BOOKS.slice();
  }
  function saveBooks() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); } catch (e) {
      toast("تعذّر الحفظ: مساحة التخزين ممتلئة");
    }
  }

  // ---------- الإحصائيات ----------
  function renderStats() {
    var reading = books.filter(function (b) { return b.status === "reading"; }).length;
    var done = books.filter(function (b) { return b.status === "done"; }).length;
    var todo = books.filter(function (b) { return b.status === "todo"; }).length;
    $("statTotal").textContent = books.length;
    $("statReading").textContent = reading;
    $("statDone").textContent = done;
    $("statTodo").textContent = todo;
  }

  // ---------- التصنيفات ----------
  function allCategories() {
    var set = {};
    books.forEach(function (b) { if (b.category) set[b.category.trim()] = true; });
    return Object.keys(set).sort();
  }
  function renderCategoryOptions() {
    var current = categoryFilter.value || "all";
    categoryFilter.innerHTML = '<option value="all">كل التصنيفات</option>';
    allCategories().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
    var exists = Array.prototype.some.call(categoryFilter.options, function (o) { return o.value === current; });
    categoryFilter.value = exists ? current : "all";

    var dl = $("categoryList");
    if (dl) {
      dl.innerHTML = "";
      allCategories().forEach(function (c) {
        var o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        dl.appendChild(o);
      });
    }
  }

  // ---------- التصفية والعرض ----------
  function getFiltered() {
    var q = searchInput.value.trim();
    var cat = categoryFilter.value;
    var st = statusFilter.value;
    var out = books.filter(function (b) {
      var matchQ = !q ||
        (b.title && b.title.indexOf(q) !== -1) ||
        (b.author && b.author.indexOf(q) !== -1);
      var matchC = cat === "all" || b.category === cat;
      var matchS = st === "all" || b.status === st;
      return matchQ && matchC && matchS;
    });
    var sort = sortSelect.value;
    out.sort(function (a, b) {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "", "ar");
      if (sort === "author") return (a.author || "").localeCompare(b.author || "", "ar");
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "\"");
  }

  function starsText(n) {
    n = Number(n) || 0;
    if (!n) return '<span style="color:#9aa5a0;font-size:.8rem">بلا تقييم</span>';
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
    return '<span class="book-rating" title="التقييم: ' + n + ' / 5">' + s + "</span>";
  }

  function renderBooks() {
    renderStats();
    renderCategoryOptions();
    var list = getFiltered();

    if (!list.length) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      grid.innerHTML = list.map(cardHtml).join("");
    }

    var total = books.length;
    resultCount.textContent = list.length === total
      ? "عرض " + total + " من الكتب"
      : "عرض " + list.length + " من أصل " + total + " كتاب";
  }

  function cardHtml(b) {
    var statusClass = b.status === "reading" ? "badge-reading" : b.status === "done" ? "badge-done" : "badge-todo";
    var letter = (b.title || "؟").trim().charAt(0) || "؟";
    var meta = [];
    if (b.pages) meta.push("📄 " + escapeHtml(b.pages) + " صفحة");
    if (b.year) meta.push("📅 " + escapeHtml(b.year));
    var notes = b.notes ? '<div class="book-notes">' + escapeHtml(b.notes) + "</div>" : "";

    return (
      '<article class="book-card" data-id="' + escapeHtml(b.id) + '">' +
        '<div class="book-cover"><span class="cover-letter">' + escapeHtml(letter) + "</span></div>" +
        '<div class="book-body">' +
          "<h3 class='book-title'>" + escapeHtml(b.title) + "</h3>" +
          "<p class='book-author'>✍️ " + escapeHtml(b.author) + "</p>" +
          '<div class="badges">' +
            '<span class="badge badge-cat">' + escapeHtml(b.category) + "</span>" +
            '<span class="badge ' + statusClass + '">' + STATUS_LABELS[b.status] + "</span>" +
          "</div>" +
          (meta.length ? '<div class="book-meta"><span>' + meta.join("</span><span>") + "</span></div>" : "") +
          starsText(b.rating) +
          notes +
        "</div>" +
        '<div class="status-quick" title="تغيير سريع للحالة">' +
          quickBtn(b, "todo", "لم أبدأ") + quickBtn(b, "reading", "أقرأ") + quickBtn(b, "done", "انتهيت") +
        "</div>" +
        '<div class="book-actions">' +
          '<button class="btn btn-small btn-edit" data-action="edit">✏️ تعديل</button>' +
          '<button class="btn btn-small btn-del" data-action="delete">🗑️ حذف</button>' +
        "</div>" +
      "</article>"
    );
  }

  function quickBtn(b, value, label) {
    var active = b.status === value ? "active-" + value : "";
    return '<button data-action="status" data-value="' + value + '" class="' + active + '">' + label + "</button>";
  }

  // ---------- النوافذ ----------
  function openModal(editBook) {
    if (!bookModal) return;
    if (formError) formError.classList.add("hidden");
    bookForm.reset();
    if (editBook) {
      $("modalTitle").textContent = "تعديل الكتاب";
      $("bookId").value = editBook.id;
      $("titleInput").value = editBook.title || "";
      $("authorInput").value = editBook.author || "";
      $("categoryInput").value = editBook.category || "";
      $("statusInput").value = editBook.status || "todo";
      $("pagesInput").value = editBook.pages || "";
      $("yearInput").value = editBook.year || "";
      $("notesInput").value = editBook.notes || "";
      setRating(Number(editBook.rating) || 0);
      $("saveBtn").textContent = "💾 حفظ التعديلات";
    } else {
      $("modalTitle").textContent = "إضافة كتاب جديد";
      $("bookId").value = "";
      $("statusInput").value = "todo";
      setRating(0);
      $("saveBtn").textContent = "💾 حفظ الكتاب";
    }
    bookModal.classList.remove("hidden");
    setTimeout(function () { $("titleInput").focus(); }, 50);
  }
  function closeModal() { if (bookModal) bookModal.classList.add("hidden"); }
  function openDelete(id) {
    var b = books.find(function (x) { return x.id === id; });
    deleteTargetId = id;
    $("delText").textContent = b
      ? 'هل أنت متأكد من حذف "' + b.title + '"؟ لا يمكن التراجع عن هذا الإجراء.'
      : "هل أنت متأكد من حذف هذا الكتاب؟";
    deleteModal.classList.remove("hidden");
  }
  function closeDelete() { if (deleteModal) deleteModal.classList.add("hidden"); deleteTargetId = null; }

  function setRating(n) {
    currentRating = n;
    var btns = $("starsInput").querySelectorAll("button");
    btns.forEach(function (btn) {
      btn.classList.toggle("lit", Number(btn.dataset.v) <= n);
    });
  }

  // ---------- التنبيهات ----------
  function toast(msg) {
    if (!toastWrap) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = "✓ " + msg;
    toastWrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .3s";
      setTimeout(function () { el.remove(); }, 300);
    }, 2200);
  }

  // ---------- حالة الدخول / Supabase ----------
  function showLoginScreen() { if (loginScreen) loginScreen.classList.remove("hidden"); }
  function hideLoginScreen() { if (loginScreen) loginScreen.classList.add("hidden"); }
  function setAuthUI() {
    var loggedIn = !!(currentUser && isSupabaseActive);
    if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline-block" : "none";
    var loginBtn = document.querySelector("#loginBtn");
    if (loginBtn) loginBtn.style.display = loggedIn ? "none" : "inline-block";
  }

  // ---------- تهيئة Supabase ----------
  function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log("ℹ️ Supabase URL not configured - using localStorage only");
      isSupabaseActive = false;
      return;
    }
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("🔗 Supabase initialized with anon key");

      supabase.auth.getUser().then(function (res) {
        if (res.error) {
          console.error("❌ خطأ في التحقق من الجلسة:", res.error);
          isSupabaseActive = false;
          return;
        }
        if (res.data && res.data.user) {
          currentUser = res.data.user;
          userId = currentUser.id;
          isSupabaseActive = true;
          setAuthUI();
          fetchUserBooks();
        } else {
          isSupabaseActive = false;
        }
      }).catch(function (err) {
        console.error("❌ خطأ في تهيئة Supabase:", err);
        isSupabaseActive = false;
      });
    } catch (err) {
      console.error("❌ خطأ في تهيئة Supabase:", err);
      isSupabaseActive = false;
    }
  }

  // جلب كتب المستخدم من Supabase
  function fetchUserBooks() {
    if (!currentUser || !supabase) return;

    supabase.from("books").select("*").eq("user_id", userId).order("created_at", { ascending: false }).then(function (res) {
      var data = res.data;
      var error = res.error;
      if (error) {
        console.error("❌ خطأ في جلب الكتب:", error);
        isSupabaseActive = false;
        books = loadBooks();
        renderBooks();
        return;
      }
      var userBooks = data || [];
      isSupabaseActive = true;
      books = userBooks.map(function (b) {
        var c = Object.assign({}, b);
        c._from = "supabase";
        return c;
      });
      renderBooks();
    }).catch(function (err) {
      console.error("❌ خطأ في جلب الكتب:", err);
      isSupabaseActive = false;
      books = loadBooks();
      renderBooks();
    });
  }

  // إعداد مستمعي الأحداث لدخول auth
  function setupAuthListeners() {
    // يمكن إضافة مستمعي أحداث هنا لمراقبة تغييرات حالة الدخول
  }

  // تسجيل الدخول
  window.loginWithSupabase = function (email, password) {
    if (!supabase) {
      alert("❌ خدمة الدخول غير متوفرة");
      return;
    }
    var loginBtn = document.querySelector("#loginBtn");
    if (loginBtn) { loginBtn.textContent = "جاري الدخول..."; loginBtn.disabled = true; }
    supabase.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (loginBtn) { loginBtn.textContent = "🔐 دخول"; loginBtn.disabled = false; }
      var error = res.error;
      if (error) {
        if (loginError) { loginError.textContent = "❌ خطأ في الدخول: " + (error.message || "حاول مرة أخرى"); loginError.classList.remove("hidden"); }
        return;
      }
      currentUser = res.data.user;
      userId = currentUser.id;
      isSupabaseActive = true;
      hideLoginScreen();
      setAuthUI();
      fetchUserBooks();
      toast("✓ تم الدخول بنجاح");
    }).catch(function (err) {
      if (loginBtn) { loginBtn.textContent = "🔐 دخول"; loginBtn.disabled = false; }
      if (loginError) { loginError.textContent = "❌ خطأ في الدخول: " + (err && err.message ? err.message : "حاول مرة أخرى"); loginError.classList.remove("hidden"); }
    });
  };

  // تسجيل الخروج
  window.logoutFromSupabase = function () {
    if (!supabase) { hideLoginScreen(); return; }
    supabase.auth.signOut().then(function () {
      currentUser = null;
      userId = null;
      isSupabaseActive = false;
      hideLoginScreen();
      setAuthUI();
      books = loadBooks();
      renderBooks();
      toast("✓ تم الخروج");
    }).catch(function (err) {
      alert("❌ خطأ في الخروج: " + (err && err.message ? err.message : ""));
    });
  };

  // إضافة كتاب إلى Supabase أو localStorage
  function addBookToStorage(bookData) {
    if (isSupabaseActive && currentUser && supabase) {
      supabase.from("books").insert({
        title: bookData.title,
        author: bookData.author,
        category: bookData.category,
        status: bookData.status,
        pages: bookData.pages,
        year: bookData.year,
        rating: bookData.rating,
        notes: bookData.notes,
        user_id: userId
      }).then(function (res) {
        if (res.error) {
          alert("❌ خطأ في الحفظ: " + (res.error.message || ""));
          saveBookLocally(bookData);
        } else {
          toast("✓ تمت الإضافة إلى مكتبتك السحابية");
          fetchUserBooks();
        }
      }).catch(function (err) {
        alert("❌ خطأ في الحفظ: " + (err && err.message ? err.message : ""));
        saveBookLocally(bookData);
      });
    } else {
      saveBookLocally(bookData);
    }
  }

  // حفظ كتاب إلى localStorage
  function saveBookLocally(bookData) {
    books.unshift({
      id: uid(), title: bookData.title, author: bookData.author, category: bookData.category,
      status: bookData.status, pages: bookData.pages,
      year: bookData.year, rating: bookData.rating,
      notes: bookData.notes, createdAt: Date.now(),
      _from: "localStorage"
    });
    saveBooks();
    renderBooks();
    toast("✓ تم الحفظ محلياً في المتصفح");
  }

  // تعديل كتاب
  function updateBookInStorage(id, updatedData) {
    var b = books.find(function (x) { return x.id === id; });
    if (!b) return;

    Object.assign(b, updatedData);

    if (isSupabaseActive && currentUser && supabase) {
      supabase.from("books").update({
        title: updatedData.title,
        author: updatedData.author,
        category: updatedData.category,
        status: updatedData.status,
        pages: updatedData.pages,
        year: updatedData.year,
        rating: updatedData.rating,
        notes: updatedData.notes
      }).eq("id", id).eq("user_id", userId).then(function (res) {
        if (res.error) {
          alert("❌ خطأ في التعديل: " + (res.error.message || ""));
          saveBooks();
        } else {
          toast("✓ تم تحديث الكتاب بنجاح");
          fetchUserBooks();
        }
      }).catch(function (err) {
        alert("❌ خطأ في التعديل: " + (err && err.message ? err.message : ""));
        saveBooks();
      });
    } else {
      saveBooks();
      toast("✓ تم تحديث الكتاب محلياً");
    }
  }

  // حذف كتاب
  function deleteBookFromStorage(id) {
    if (isSupabaseActive && currentUser && supabase) {
      supabase.from("books").delete().eq("id", id).eq("user_id", userId).then(function (res) {
        if (res.error) {
          alert("❌ خطأ في الحذف: " + (res.error.message || ""));
        } else {
          toast("✓ تم حذف الكتاب من حسابك");
          fetchUserBooks();
        }
      }).catch(function (err) {
        alert("❌ خطأ في الحذف: " + (err && err.message ? err.message : ""));
      });
    } else {
      books = books.filter(function (x) { return x.id !== id; });
      saveBooks();
      toast("✓ تم الحذف محلياً");
    }
  }

  // ---------- الأحداث ----------
  $("addBtn").addEventListener("click", function () { openModal(null); });
  $("emptyAddBtn").addEventListener("click", function () { openModal(null); });
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  bookModal.addEventListener("click", function (e) { if (e.target === bookModal) closeModal(); });
  deleteModal.addEventListener("click", function (e) { if (e.target === deleteModal) closeDelete(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeModal(); closeDelete(); }
  });

  $("starsInput").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var v = Number(btn.dataset.v);
    setRating(v === currentRating ? 0 : v);
  });

  $("loginBtn").addEventListener("click", function (e) {
    e.preventDefault();
    showLoginScreen();
  });
  $("logoutBtn").addEventListener("click", function (e) {
    e.preventDefault();
    window.logoutFromSupabase();
  });
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("emailInput") ? $("emailInput").value.trim() : "";
      var password = $("passwordInput") ? $("passwordInput").value : "";
      if (!email || !password) {
        if (loginError) { loginError.textContent = "❌ يرجى إدخال البريد الإلكتروني وكلمة المرور."; loginError.classList.remove("hidden"); }
        return;
      }
      window.loginWithSupabase(email, password);
    });
  }
  $("loginCancelBtn").addEventListener("click", function (e) {
    e.preventDefault();
    hideLoginScreen();
  });

  bookForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = $("titleInput").value.trim();
    var author = $("authorInput").value.trim();
    var category = $("categoryInput").value.trim();
    var status = $("statusInput").value;
    var pages = parseInt($("pagesInput").value, 10);
    var year = parseInt($("yearInput").value, 10);
    var notes = $("notesInput").value.trim();
    var id = $("bookId").value;

    if (!title || !author || !category) {
      if (formError) formError.classList.remove("hidden");
      return;
    }
    if (formError) formError.classList.add("hidden");

    var bookData = {
      title: title, author: author, category: category,
      status: status, pages: isNaN(pages) ? "" : pages,
      year: isNaN(year) ? "" : year, rating: currentRating,
      notes: notes
    };

    if (id) {
      updateBookInStorage(id, bookData);
    } else {
      addBookToStorage(bookData);
    }
    closeModal();
  });

  grid.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var card = e.target.closest(".book-card");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var action = btn.getAttribute("data-action");

    if (action === "edit") {
      var b = books.find(function (x) { return x.id === id; });
      if (b) openModal(b);
    } else if (action === "delete") {
      deleteBookFromStorage(id);
    } else if (action === "status") {
      var nb = books.find(function (x) { return x.id === id; });
      if (nb) {
        nb.status = btn.getAttribute("data-value");
        if (isSupabaseActive && currentUser && supabase) {
          supabase.from("books").update({ status: nb.status }).eq("id", id).eq("user_id", userId).then(function (res) {
            if (res.error) toast("❌ تعذّر تحديث الحالة: " + (res.error.message || ""));
          }).catch(function (err) { toast("❌ تعذّر تحديث الحالة: " + (err && err.message ? err.message : "")); });
        }
        saveBooks();
        renderBooks();
        toast("تم تحديث حالة «" + nb.title + "» إلى: " + STATUS_LABELS[nb.status]);
      }
    }
  });

  $("delCancelBtn").addEventListener("click", closeDelete);
  $("delConfirmBtn").addEventListener("click", function () {
    if (!deleteTargetId) return;
    var b = books.find(function (x) { return x.id === deleteTargetId; });
    if (isSupabaseActive && currentUser && supabase) {
      deleteBookFromStorage(deleteTargetId);
      closeDelete();
    } else {
      books = books.filter(function (x) { return x.id !== deleteTargetId; });
      saveBooks();
      closeDelete();
      renderBooks();
      toast(b ? "تم حذف «" + b.title + "»" : "تم حذف الكتاب");
    }
  });

  $("resetBtn").addEventListener("click", function () {
    if (!confirm("سيتم استبدال مكتبتك الحالية بالبيانات التجريبية. متابعة؟")) return;
    books = SEED_BOOKS.map(function (b) {
      var c = Object.assign({}, b);
      c.id = uid();
      c.createdAt = Date.now();
      return c;
    });
    searchInput.value = "";
    categoryFilter.value = "all";
    statusFilter.value = "all";
    saveBooks();
    renderBooks();
    toast("تمت استعادة البيانات التجريبية");
  });

  [searchInput, categoryFilter, statusFilter, sortSelect].forEach(function (el) {
    el.addEventListener("input", renderBooks);
    el.addEventListener("change", renderBooks);
  });

  // ---------- التشغيل ----------
  if (window.supabase && window.supabase.createClient) {
    initSupabase();
  } else {
    isSupabaseActive = false;
  }
  renderBooks();

  window.loginWithSupabase = window.loginWithSupabase || function () {};
  window.logoutFromSupabase = window.logoutFromSupabase || function () {};
})();
