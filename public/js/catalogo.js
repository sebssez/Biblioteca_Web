(() => {
  const root = document.getElementById("folio-catalog-page");
  if (!root) return;
  const get = (selector) => root.querySelector(selector);
  const categories = [...new Set(FolioClient.books().map((b) => b.categoria))];
  const palette = [
    ["#243f32", "#eee7cf"],
    ["#d9c5b4", "#4a2925"],
    ["#b83930", "#fff4db"],
    ["#e7dfb9", "#29403c"],
    ["#493b35", "#f0dbc1"],
    ["#a9b8a4", "#253d33"],
    ["#cbac83", "#412e25"],
    ["#6b302d", "#f1e4cc"],
  ];
  const books = FolioClient.books().map((book, index) => ({
    ...book,
    color: book.color || palette[index % palette.length][0],
    tinta: book.tinta || palette[index % palette.length][1],
  }));
  const params = new URLSearchParams(globalThis.location?.search || "");
  const state = {
    query: params.get("q") || "",
    category: categories.includes(params.get("categoria"))
      ? params.get("categoria")
      : "",
    available: false,
    sort: "editorial",
    page: 1,
  };
  const PAGE_SIZE = 20;
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .trim();
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  function matchingBooks() {
    const query = normalize(state.query);
    const result = books.filter(
      (book) =>
        normalize(book.titulo).includes(query) &&
        (!state.category || book.categoria === state.category) &&
        (!state.available || book.cantidad > 0),
    );
    if (state.sort === "title")
      result.sort((a, b) =>
        a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" }),
      );
    return result;
  }

  function cover(book) {
    return `<div class="book-cover ${book.titulo.length > 32 ? "long-title" : ""}" style="--book-color:${book.color};--book-ink:${book.tinta}"><span class="book-cover-author">${escape(book.autor)}</span><strong class="book-cover-title">${escape(book.titulo)}</strong><span class="book-cover-mark" aria-hidden="true">${escape(book.marca)}</span><span class="book-cover-footer">FOLIO / ${escape(book.categoria)}</span></div>`;
  }

  function bookCard(book) {
    return `<article class="catalog-book"><button type="button" data-book="${book.id}" aria-label="Ver ficha de ${escape(book.titulo)}">${cover(book)}<span class="book-availability ${book.cantidad ? "" : "is-unavailable"}">${book.cantidad ? `Disponible · ${book.cantidad} ${book.cantidad === 1 ? "ejemplar" : "ejemplares"}` : "Sin ejemplares disponibles"}</span><h3>${escape(book.titulo)}</h3><p class="book-author">${escape(book.autor)}</p><span class="book-open">Ver libro ↗</span></button></article>`;
  }

  get(".catalog-categories").innerHTML = [
    '<button type="button" data-category="" aria-pressed="true">Todo el estante</button>',
    ...categories.map(
      (c) =>
        `<button type="button" data-category="${escape(c)}" aria-pressed="false">${escape(c)}</button>`,
    ),
  ].join("");

  function renderList() {
    const matching = matchingBooks();
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const visible = matching.slice(start, start + PAGE_SIZE);
    get("#catalog-results").textContent = matching.length
      ? `Mostrando ${start + 1}–${start + visible.length} de ${matching.length} libros`
      : "0 libros encontrados";
    get("#catalog-sections").innerHTML = categories
      .map((category) => {
        const section = visible.filter((book) => book.categoria === category);
        return section.length
          ? `<section class="catalog-section" aria-label="${escape(category)}"><div class="catalog-section-heading"><h2>${escape(category)}</h2><span>${section.length} ${section.length === 1 ? "título" : "títulos"} en esta página</span></div><div class="catalog-grid">${section.map(bookCard).join("")}</div></section>`
          : "";
      })
      .join("");
    get("#catalog-empty").hidden = matching.length > 0;
    root
      .querySelectorAll("[data-category]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.category === state.category),
        ),
      );
    get("#catalog-prev").disabled = state.page === 1;
    get("#catalog-next").disabled = state.page >= totalPages;
    get("#catalog-page-buttons").innerHTML = Array.from(
      { length: totalPages },
      (_, index) =>
        `<button type="button" data-page="${index + 1}" aria-label="Página ${index + 1}" ${index + 1 === state.page ? 'aria-current="page"' : ""}>${index + 1}</button>`,
    ).join("");
    get(".catalog-pagination").hidden = matching.length === 0;
    get("#catalog-page-note").textContent = matching.length
      ? `Página ${state.page} de ${totalPages} · Hasta ${PAGE_SIZE} libros por página`
      : "";
  }

  function switchView(update, target) {
    const perform = () => {
      update();
      target.scrollIntoView({ behavior: "auto", block: "start" });
    };
    if (
      typeof document.startViewTransition === "function" &&
      !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      document.startViewTransition(perform);
    } else perform();
  }

  function openBook(id, animate = true) {
    const book = books.find((entry) => entry.id === id);
    if (!book) {
      FolioClient.message(
        "Este libro ya no está en el catálogo. Busca otra lectura en el estante.",
      );
      return;
    }
    const update = () => {
      get("#detail-cover").innerHTML = cover(book);
      get("#detail-title").textContent = book.titulo;
      get("#detail-author").textContent = book.autor;
      get("#detail-category").textContent = `FOLIO / ${book.categoria}`;
      get("#detail-description").textContent = book.descripcion;
      get("#detail-category-value").textContent = book.categoria;
      get("#detail-quantity").textContent = book.cantidad
        ? `${book.cantidad} ${book.cantidad === 1 ? "ejemplar disponible" : "ejemplares disponibles"}`
        : "Sin ejemplares disponibles";
      get("#detail-reference").textContent =
        `Ficha FOL-${String(book.id).padStart(4, "0")}`;
      const user = FolioClient.session();
      const existing =
        user?.rol === "usuario"
          ? FolioClient.myLoans().find(
              (l) => l.libro_id === book.id && l.estado !== "devuelto",
            )
          : null;
      get("#detail-request").innerHTML = existing
        ? `<a class="detail-primary" href="prestamos.html?prestamo=${existing.id}">Ver mi solicitud ↗</a>`
        : user?.rol === "admin"
          ? '<a class="detail-primary" href="admin/libros.html">Administrar colección ↗</a>'
          : !book.cantidad
            ? '<button type="button" class="detail-primary" disabled>No disponible por el momento</button>'
            : user
              ? `<button type="button" class="detail-primary" data-request="${book.id}">Solicitar préstamo ↗</button>`
              : `<a class="detail-primary" href="login.html?libro=${book.id}">Ingresar para solicitar ↗</a>`;
      get("#catalog-list-view").hidden = true;
      get("#catalog-detail-view").hidden = false;
      document.title = `${book.titulo} | FOLIO`;
    };
    if (animate) switchView(update, get("#catalog-detail-view"));
    else update();
  }

  function backToList() {
    switchView(() => {
      get("#catalog-detail-view").hidden = true;
      get("#catalog-list-view").hidden = false;
      document.title = "Catálogo | FOLIO";
    }, get("#catalog-list-view"));
  }

  function reset() {
    state.query = "";
    state.category = "";
    state.available = false;
    state.sort = "editorial";
    state.page = 1;
    get("#catalog-query").value = "";
    get("#catalog-available").checked = false;
    get("#catalog-sort").value = "editorial";
    renderList();
  }

  get("#catalog-query").value = state.query;
  get("#catalog-query").addEventListener("input", () => {
    state.query = get("#catalog-query").value;
    state.page = 1;
    renderList();
  });
  get("#catalog-search").addEventListener("submit", (event) => {
    event.preventDefault();
    renderList();
  });
  get("#catalog-available").addEventListener("change", () => {
    state.available = get("#catalog-available").checked;
    state.page = 1;
    renderList();
  });
  get("#catalog-sort").addEventListener("change", () => {
    state.sort = get("#catalog-sort").value;
    state.page = 1;
    renderList();
  });
  const goToPage = (page) => {
    state.page = page;
    renderList();
    get(".catalog-filters").scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  };
  get("#catalog-prev").addEventListener("click", () =>
    goToPage(state.page - 1),
  );
  get("#catalog-next").addEventListener("click", () =>
    goToPage(state.page + 1),
  );
  root.addEventListener("click", (event) => {
    const request = event.target.closest("[data-request]");
    if (request && !request.disabled) {
      request.disabled = true;
      try {
        const loan = FolioClient.requestLoan(Number(request.dataset.request));
        FolioClient.go("prestamos.html?prestamo=" + loan.id);
      } catch (error) {
        FolioClient.message(error.message);
        request.disabled = false;
      }
      return;
    }
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.book) openBook(Number(button.dataset.book));
    else if (button.dataset.page) goToPage(Number(button.dataset.page));
    else if (button.hasAttribute("data-category")) {
      state.category = button.dataset.category;
      state.page = 1;
      renderList();
    } else if (button.dataset.action === "back") backToList();
    else if (button.dataset.action === "reset") reset();
  });
  renderList();
  const initialBook = Number(params.get("libro"));
  if (params.has("libro")) openBook(initialBook, false);
})();

// Al renderizar la lista de libros dinámicamente:
libros.forEach((libro, index) => {
  const card = document.createElement('div');
  card.className = 'libro-card';
  card.style.animationDelay = `${index * 0.08}s`; // Entran una por una
  // ... resto del HTML de la tarjeta ...
  contenedor.appendChild(card);
});