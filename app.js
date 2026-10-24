/* مكتبتي — منطق إدارة المكتبة الشخصية (localStorage + Supabase اختياري) */
(function () {
  "use strict";

  var STORAGE_KEY = "maktabati_books_v1";

  var STATUS_LABELS = {
    todo: "لم أبدأ",
    reading: "أقرأ حاليًا",
    done: "انتهيت"
  };

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
      opt.value = c; opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
    // حافظ على الاختيار إن كان موجودًا
    var exists = Array.prototype.some.call(categoryFilter.options, function (o) { return o.value === current; });
    categoryFilter.value = exists ? current : "all";

    var dl = $("categoryList");
    dl.innerHTML = "";
    allCategories().forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      dl.appendChild(o);
    });
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
    formError.classList.add("hidden");
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
  function closeModal() { bookModal.classList.add("hidden"); }
  function openDelete(id) {
    var b = books.find(function (x) { return x.id === id; });
    deleteTargetId = id;
    $("delText").textContent = b
      ? 'هل أنت متأكد من حذف "' + b.title + '"؟ لا يمكن التراجع عن هذا الإجراء.'
      : "هل أنت متأكد من حذف هذا الكتاب؟";
    deleteModal.classList.remove("hidden");
  }
  function closeDelete() { deleteModal.classList.add("hidden"); deleteTargetId = null; }

  function setRating(n) {
    currentRating = n;
    var btns = $("starsInput").querySelectorAll("button");
    btns.forEach(function (btn) {
      btn.classList.toggle("lit", Number(btn.dataset.v) <= n);
    });
  }

  // ---------- التنبيهات ----------
  function toast(msg) {
    var wrap = $("toastWrap");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = "✓ " + msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .3s";
      setTimeout(function () { el.remove(); }, 300);
    }, 2200);
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
    setRating(v === currentRating ? 0 : v); // نقرة ثانية تلغي التقييم
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
      formError.classList.remove("hidden");
      return;
    }
    formError.classList.add("hidden");

    if (id) {
      var b = books.find(function (x) { return x.id === id; });
      if (b) {
        b.title = title; b.author = author; b.category = category;
        b.status = status;
        b.pages = isNaN(pages) ? "" : pages;
        b.year = isNaN(year) ? "" : year;
        b.rating = currentRating; b.notes = notes;
        toast("تم حفظ التعديلات بنجاح");
      }
    } else {
      books.unshift({
        id: uid(), title: title, author: author, category: category,
        status: status, pages: isNaN(pages) ? "" : pages,
        year: isNaN(year) ? "" : year, rating: currentRating,
        notes: notes, createdAt: Date.now()
      });
      toast("تمت إضافة الكتاب بنجاح 🎉");
    }
    saveBooks();
    renderBooks();
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
      openDelete(id);
    } else if (action === "status") {
      var nb = books.find(function (x) { return x.id === id; });
      if (nb) {
        nb.status = btn.getAttribute("data-value");
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
    books = books.filter(function (x) { return x.id !== deleteTargetId; });
    saveBooks();
    closeDelete();
    renderBooks();
    toast(b ? "تم حذف «" + b.title + "»" : "تم حذف الكتاب");
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

  // ---------- تشغيل ----------
  // Use localStorage only (no Supabase integration in this version)
  renderBooks();
})();