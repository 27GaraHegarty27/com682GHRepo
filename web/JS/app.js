// ==============================
// app.js (FULL FILE) + DELETE SUPPORT
// ==============================

// === Azure Logic App endpoints & storage account ===
const API_UPLOAD_FILE_URL =
  "https://prod-06.uksouth.logic.azure.com:443/workflows/20c264e418f94ba6be7214b2c0eecffe/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=SmI4O1IIGCA3sbQVfnvfVQ8DZDqU0M3PFx_PlCcjHps";

const API_POSTS_CREATE_URL =
  "https://prod-03.uksouth.logic.azure.com:443/workflows/2f5a84fe5dcd410f9bd90c863d4da62e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=2vB3A6twCw-8TI9y4ZM4AkqmoJbBwu6EDL9_2diuBNI";

const API_POSTS_LIST_URL =
  "https://prod-01.uksouth.logic.azure.com:443/workflows/18c0c93b369b43648d04581e2a311cb5/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=2U3B0uYZP2fhImWgHHtSgPO_rUnxY2FwNwiOUlIqagk";

// NOTE: This URL includes /posts/{id}/{pk} already (encoded)
const API_POSTS_GET_URL =
  "https://prod-23.uksouth.logic.azure.com/workflows/b571a77b0c694468a9af4e5be1c43f67/triggers/When_an_HTTP_request_is_received/paths/invoke/posts/%7Bid%7D/%7Bpk%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=mfxfsar2Te2kqYuXn3hVPSG_zlh5MoXuU5I73cYugzM";

// NOTE: This URL includes /posts/{id}/{pk} already (encoded)
const API_POSTS_UPDATE_URL =
  "https://prod-10.uksouth.logic.azure.com/workflows/a85844d9611d488cb3a6c7d04f8c5a17/triggers/When_an_HTTP_request_is_received/paths/invoke/posts/%7Bid%7D/%7Bpk%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=tKjJ_tH2FnroTWc4waEKguf5aRrLH24Zv9o-LLTYP8A";

// NOTE: This URL includes /posts/{id}/{pk} already (encoded)
const API_POSTS_DELETE_URL =
  "https://prod-57.uksouth.logic.azure.com/workflows/c818d15f4dd049659e070e2b4f5df223/triggers/When_an_HTTP_request_is_received/paths/invoke/posts/%7Bid%7D/%7Bpk%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=hnqMMLPZxXLhzEjGTBNjObAKemtoEL1CgQPI0CPs1Ps";

const BLOB_ACCOUNT = "https://storcom682.blob.core.windows.net";

// === App state ===
let currentPost = null; // { id, pk, doc }

// === jQuery handlers ===
$(document).ready(function () {
  console.log("app.js loaded ✅");

  $("#retImages").on("click", getImages);
  $("#subNewForm").on("click", submitNewAsset);

  // Get single post
  $("#btnGetPost").on("click", getPostFromInput);

  // Clear (support both ids just in case)
  $("#btnClearGetPost, #btnClearPost").on("click", clearSinglePostUI);

  // Save edit (delegated because the button is rendered dynamically)
  $(document).on("click", "#btnSaveEdit", saveEditTitle);

  // ✅ NEW: Delete post (delegated; button is rendered dynamically)
  $(document).on("click", "#btnDeletePost", deleteCurrentPost);

  // Allow Enter key in input to trigger GET
  $("#getPostIdInput").on("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      getPostFromInput();
    }
  });
});

// ==============================
// Upload new asset
// ==============================
function submitNewAsset() {
  const video_id =
    (crypto.randomUUID && crypto.randomUUID()) ||
    "vid-" + Date.now() + "-" + Math.floor(Math.random() * 100000);

  const file = $("#UpFile")[0].files[0];
  if (!file) {
    alert("Please choose a file first.");
    return;
  }

  const fileName = $("#FileName").val() || file.name;
  const userId = $("#userID").val();
  const title = fileName;

  const uploadData = new FormData();
  uploadData.append("FileName", fileName);
  uploadData.append("userID", userId);
  uploadData.append("userName", $("#userName").val());
  uploadData.append("video_id", video_id);
  uploadData.append("File", file);

  $.ajax({
    url: API_UPLOAD_FILE_URL,
    data: uploadData,
    cache: false,
    enctype: "multipart/form-data",
    contentType: false,
    processData: false,
    type: "POST",
    success: function (uploadRes) {
      console.log("Upload response:", uploadRes);

      const postBody = {
        video_id: video_id,
        userId: userId,
        title: title,
        blobContainer: uploadRes.blobContainer,
        blobName: uploadRes.blobName
      };

      $.ajax({
        url: API_POSTS_CREATE_URL,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(postBody),
        success: function (postRes) {
          console.log("Post created:", postRes);
          alert("Uploaded + post created successfully!");
          getImages(); // refresh list
        },
        error: function (xhr, status, err) {
          console.error("Post create failed:", status, err, xhr?.responseText);
          alert("Upload worked, but creating the post failed. See console.");
        }
      });
    },
    error: function (xhr, status, err) {
      console.error("Upload failed:", status, err, xhr?.responseText);
      alert("Upload failed — see console for details.");
    }
  });
}

// ==============================
// LIST (Cosmos-backed) - View Images
// ==============================
function getImages() {
  const $list = $("#ImageList");
  $list
    .addClass("media-grid")
    .html('<div class="spinner-border" role="status"><span>Loading...</span></div>');

  $.ajax({
    url: API_POSTS_LIST_URL,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received (LIST):", data);

      const items = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.Documents) ? data.Documents : []);

      if (!items.length) {
        $list.html("<p>No media found.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      $.each(items, function (_, val) {
        try {
          const id = val.id || val.video_id;
          const title = val.title || val.blobName || "(untitled)";
          const status = val.status || "unknown";

          const blobUrl =
            val.blobUrl ||
            (val.blobContainer && val.blobName
              ? `${BLOB_ACCOUNT.replace(/\/+$/g, "")}/${val.blobContainer}/${val.blobName}`
              : "");

          if (!id) {
            cards.push(`
              <div class="media-card">
                <div class="media-body">
                  <span class="media-title" style="color:#b91c1c;">Missing id</span>
                  <div>${escapeHtml(title)}</div>
                </div>
              </div>
            `);
            return;
          }

          const isVideo = isLikelyVideo({ url: blobUrl, fileName: val.blobName });

          if (isVideo) {
            videoCounter++;
            const label = `video${videoCounter}`;
            cards.push(`
              <div class="media-card js-open-post" data-id="${escapeHtml(id)}">
                <div class="media-thumb">
                  <a class="video-link" href="${blobUrl}" target="_blank" rel="noopener">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(title)}</span>
                  <div>Status: ${escapeHtml(status)}</div>
                  <div class="hint">Click card to edit / delete</div>
                </div>
              </div>
            `);
          } else {
            cards.push(`
              <div class="media-card js-open-post" data-id="${escapeHtml(id)}">
                <div class="media-thumb">
                  <img src="${blobUrl}"
                       alt="${escapeHtml(title)}"
                       onerror="imageFallbackToLink(this,'${blobUrl}','Open media')" />
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(title)}</span>
                  
                  <div class="hint">Click card to edit / delete</div>
                  <div class="image-error"></div>
                </div>
              </div>
            `);
          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));

      // Click a card to load into editor
      $(".js-open-post").off("click").on("click", function (e) {
        if ($(e.target).closest("a").length) return;
        const id = $(this).data("id");

        // ✅ Your preferred UX: user types one ID; pk=id
        getPostById(id, id);
      });
    },
    error: function (xhr, status, error) {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    }
  });
}

// ==============================
// GET one post (api-posts-get)
// ==============================
function getPostFromInput() {
  console.log("Get Post clicked ✅");

  const id = ($("#getPostIdInput").val() || "").trim();
  if (!id) {
    alert("Paste an id/video_id first.");
    return;
  }

  // ✅ one value input; pk=id
  getPostById(id, id);
}

function getPostById(id, pk) {
  clearSinglePostUI(false);

  const url = buildRouteUrl(API_POSTS_GET_URL, id, pk);
  console.log("Calling GET:", url);

  $("#SinglePostResult").html(
    `<div class="mt-2 p-2" style="border:1px solid #e5e7eb;border-radius:10px;">
      <div class="spinner-border" role="status"><span>Loading...</span></div>
      <span style="margin-left:8px;">Loading post...</span>
     </div>`
  );

  $.ajax({
    url,
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received (GET):", data);

      const doc = Array.isArray(data) ? data[0] : data;
      if (!doc) {
        $("#SinglePostResult").html(`<div class="mt-2 text-danger">No post found.</div>`);
        return;
      }

      currentPost = {
        id: doc.id || doc.video_id || id,
        pk: pk,
        doc
      };

      renderSinglePost(currentPost.doc);
    },
    error: function (xhr, status, err) {
      console.error("GET failed:", status, err, xhr?.responseText);
      $("#SinglePostResult").html(`<div class="mt-2 text-danger">GET failed. Check console.</div>`);
    }
  });
}

// ==============================
// UPDATE post (api-posts-update) - Edit title
// ==============================
function saveEditTitle() {
  if (!currentPost || !currentPost.id || !currentPost.pk) {
    alert("Load a post first (Get Post or click a card).");
    return;
  }

  const newTitle = ($("#editTitleInput").val() || "").trim();
  if (!newTitle) {
    alert("Please enter a new title.");
    return;
  }

  const url = buildRouteUrl(API_POSTS_UPDATE_URL, currentPost.id, currentPost.pk);
  const payload = { title: newTitle };

  console.log("Calling UPDATE (PUT):", url, payload);

  $("#editStatus").text("Saving...").css("color", "#111827");

  $.ajax({
    url,
    type: "PUT",
    contentType: "application/json",
    data: JSON.stringify(payload),
    success: function (res) {
      console.log("UPDATE success:", res);

      $("#editStatus").text("Saved ✅").css("color", "#16a34a");

      currentPost.doc.title = newTitle;
      renderSinglePost(currentPost.doc);

      getImages(); // refresh list
    },
    error: function (xhr, status, err) {
      console.error("UPDATE failed:", status, err, xhr?.responseText);
      $("#editStatus").text("Save failed ❌ (check console)").css("color", "#b91c1c");
    }
  });
}

// ==============================
// ✅ DELETE post (api-posts-delete)
// ==============================
function deleteCurrentPost() {
  if (!currentPost || !currentPost.id || !currentPost.pk) {
    alert("Load a post first (Get Post or click a card).");
    return;
  }

  const id = currentPost.id;
  const pk = currentPost.pk;

  const title = currentPost.doc?.title || "(untitled)";
  const ok = confirm(`Delete this post?\n\nTitle: ${title}\nID: ${id}`);
  if (!ok) return;

  const url = buildRouteUrl(API_POSTS_DELETE_URL, id, pk);
  console.log("Calling DELETE:", url);

  $("#deleteStatus").text("Deleting...").css("color", "#111827");
  $("#btnDeletePost").prop("disabled", true);

  $.ajax({
    url,
    type: "DELETE",
    success: function (res) {
      console.log("DELETE success:", res);

      $("#deleteStatus").text("Deleted ✅").css("color", "#16a34a");

      // Clear UI + refresh list
      clearSinglePostUI(false);
      getImages();
      alert("Post deleted successfully!");
    },
    error: function (xhr, status, err) {
      console.error("DELETE failed:", status, err, xhr?.responseText);
      $("#deleteStatus").text("Delete failed ❌ (check console)").css("color", "#b91c1c");
      $("#btnDeletePost").prop("disabled", false);
    }
  });
}

// ==============================
// Render single post (preview + editor + delete)
// ==============================
function renderSinglePost(doc) {
  const title = doc.title || "(untitled)";
  const id = doc.id || doc.video_id || "";
  const status = doc.status || "unknown";

  const blobUrl =
    doc.blobUrl ||
    (doc.blobContainer && doc.blobName
      ? `${BLOB_ACCOUNT.replace(/\/+$/g, "")}/${doc.blobContainer}/${doc.blobName}`
      : "");

  const preview = blobUrl
    ? (isLikelyVideo({ url: blobUrl, fileName: doc.blobName })
        ? `<a class="video-link" href="${blobUrl}" target="_blank" rel="noopener">Open media</a>`
        : `<img src="${blobUrl}" style="max-width:260px;border-radius:10px;border:1px solid #e5e7eb;"
                onerror="this.outerHTML='<a class=&quot;video-link&quot; href=&quot;${blobUrl}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;>Open media</a>'" />`
      )
    : `<span class="text-danger">No blobUrl/blob info found.</span>`;

  $("#SinglePostResult").html(`
    <div class="mt-3 p-3" style="border:1px solid #e5e7eb;border-radius:12px;">
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
        <div>${preview}</div>

        <div style="min-width:280px;flex:1;">
          <div><strong>Selected Post</strong></div>
          <div class="hint">Click a grid card or use Get Post.</div>

          <div style="margin-top:8px;">
            <div><strong>id:</strong> <code>${escapeHtml(id)}</code></div>
          </div>

          <hr/>

          <div><strong>Edit Caption</strong></div>
          <input id="editTitleInput" class="form-control mt-1" type="text" value="${escapeHtml(title)}" />

          <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button id="btnSaveEdit" type="button" class="btn btn-primary">Save Title</button>
            <span id="editStatus" class="hint"></span>

            <button id="btnDeletePost" type="button" class="btn btn-danger" style="margin-left:auto;">
              Delete Post
            </button>
            <span id="deleteStatus" class="hint"></span>
          </div>
        </div>
      </div>
    </div>
  `);
}

function clearSinglePostUI(clearInput = true) {
  currentPost = null;
  if (clearInput) $("#getPostIdInput").val("");
  $("#SinglePostResult").html("");
}

// ==============================
// Helpers
// ==============================
function buildRouteUrl(templateUrl, id, pk) {
  return templateUrl
    .replaceAll("%7Bid%7D", encodeURIComponent(id))
    .replaceAll("%7Bpk%7D", encodeURIComponent(pk))
    .replaceAll("{id}", encodeURIComponent(id))
    .replaceAll("{pk}", encodeURIComponent(pk));
}

function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
