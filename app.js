"use strict";

// Keep the measurement flow usable with two photos and cap the optional extras.
const MIN_PHOTOS = 2;
const MAX_PHOTOS = 4;

const photoList = document.querySelector("#photo-list");
const addPhotoButton = document.querySelector("#add-photo");
const photoCount = document.querySelector("#photo-count");
const unitsSelect = document.querySelector("#units");
const actualHeightInput = document.querySelector("#actual-height");
const errorMessage = document.querySelector("#error-message");
const notice = document.querySelector("#notice");
const photoDialog = document.querySelector("#photo-dialog");
const zoomedPhoto = document.querySelector("#zoomed-photo");
const photoDialogCaption = document.querySelector("#photo-dialog-caption");

let nextPhotoId = 1;
const photos = Array.from({ length: MIN_PHOTOS }, () => createPhotoSlot());
let noticeTimeout;

function createPhotoSlot() {
  return {
    id: nextPhotoId++,
    imageUrl: null,
  };
}

function cameraIcon() {
  return `
    <span class="camera-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 7.5h3l1.5-2h7l1.5 2h3v11H4v-11Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </span>`;
}

function renderPhotoCards() {
  photoList.innerHTML = "";

  photos.forEach((photo, index) => {
    const position = index + 1;
    const card = document.createElement("article");
    card.className = "photo-card";
    card.innerHTML = `
      <div class="photo-card-header">
        <h3 class="photo-title">
          <span class="photo-badge">${position}</span>
          Photo ${position}
        </h3>
        <button class="remove-photo" type="button" data-remove-position="${photo.id}" aria-label="Remove Photo ${position} position">
          Remove
        </button>
      </div>
      ${
        photo.imageUrl
          ? `<button class="photo-preview" type="button" data-zoom-photo="${photo.id}" aria-label="Zoom in on Photo ${position}">
              <img src="${photo.imageUrl}" alt="">
              <span class="zoom-label">Tap to zoom</span>
            </button>
            <div class="photo-controls">
              <button class="photo-control-button" type="button" data-select-photo="${photo.id}">Replace</button>
              <button class="photo-control-button delete-photo" type="button" data-delete-photo="${photo.id}">Delete</button>
            </div>`
          : `<button class="capture-placeholder" type="button" data-select-photo="${photo.id}">
              ${cameraIcon()}
              <span class="capture-copy">
                <strong>Choose photo</strong>
                <span>From this device</span>
              </span>
            </button>`
      }
      <input class="photo-input" id="photo-file-${photo.id}" type="file" accept="image/*" aria-label="Choose image for Photo ${position}">
      ${
        position === 1
          ? `<div class="baseline-note">Starting position</div>`
          : `<label class="distance-field" for="distance-${position}">
              Distance from Photo ${position - 1}
              <span class="distance-input-wrap">
                <input class="distance-input" id="distance-${position}" name="distance-${position}" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 15">
                <span class="distance-unit">${unitsSelect.value}</span>
              </span>
            </label>`
      }`;
    photoList.append(card);
  });

  photoCount.textContent = `${photos.length} of ${MAX_PHOTOS} photos`;
  addPhotoButton.disabled = photos.length >= MAX_PHOTOS;
  updateUnits();
}

function showNotice(message) {
  window.clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.classList.add("is-visible");
  noticeTimeout = window.setTimeout(() => {
    notice.classList.remove("is-visible");
  }, 3200);
}

function updateUnits() {
  const unit = unitsSelect.value;
  document.querySelector("#estimated-unit").textContent = unit;
  document.querySelector("#actual-unit").textContent = unit;
  document.querySelectorAll(".distance-unit").forEach((label) => {
    label.textContent = unit;
  });
}

function updateActualHeightMessage() {
  const value = actualHeightInput.value.trim();

  errorMessage.classList.remove("is-error");

  // This version validates the optional reference height but does not calculate error.
  if (value === "") {
    errorMessage.textContent = "Enter actual height to see error.";
    return;
  }

  const height = Number(value);
  if (!Number.isFinite(height) || height <= 0) {
    errorMessage.textContent = "Enter a valid height greater than zero.";
    errorMessage.classList.add("is-error");
    return;
  }

  errorMessage.textContent = "Error available after measurement.";
}

photoList.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const photoId = Number(
    target.dataset.selectPhoto ??
    target.dataset.zoomPhoto ??
    target.dataset.deletePhoto ??
    target.dataset.removePosition
  );
  const photo = photos.find((item) => item.id === photoId);

  if (target.dataset.selectPhoto && photo) {
    document.querySelector(`#photo-file-${photo.id}`).click();
    return;
  }

  if (target.dataset.zoomPhoto && photo?.imageUrl) {
    const position = photos.indexOf(photo) + 1;
    zoomedPhoto.src = photo.imageUrl;
    zoomedPhoto.alt = `Photo ${position}`;
    photoDialogCaption.textContent = `Photo ${position}`;
    photoDialog.showModal();
    return;
  }

  if (target.dataset.deletePhoto && photo?.imageUrl) {
    URL.revokeObjectURL(photo.imageUrl);
    photo.imageUrl = null;
    renderPhotoCards();
    showNotice("Photo deleted.");
    return;
  }

  if (target.dataset.removePosition && photo) {
    if (photos.length <= MIN_PHOTOS) {
      showNotice("At least two photo positions are needed for a measurement.");
      return;
    }

    if (photo.imageUrl) {
      URL.revokeObjectURL(photo.imageUrl);
    }
    photos.splice(photos.indexOf(photo), 1);
    renderPhotoCards();
    showNotice("Position removed. Review the remaining distances.");
  }
});

photoList.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains("photo-input")) {
    return;
  }

  const file = input.files[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showNotice("Choose an image file.");
    return;
  }

  const photoId = Number(input.id.replace("photo-file-", ""));
  const photo = photos.find((item) => item.id === photoId);
  if (!photo) {
    return;
  }

  if (photo.imageUrl) {
    URL.revokeObjectURL(photo.imageUrl);
  }
  photo.imageUrl = URL.createObjectURL(file);
  renderPhotoCards();
  showNotice("Photo selected.");
});

addPhotoButton.addEventListener("click", () => {
  if (photos.length < MAX_PHOTOS) {
    photos.push(createPhotoSlot());
    renderPhotoCards();
  }
});

document.querySelector("#close-photo-dialog").addEventListener("click", () => {
  photoDialog.close();
});

photoDialog.addEventListener("click", (event) => {
  if (event.target === photoDialog) {
    photoDialog.close();
  }
});

unitsSelect.addEventListener("change", updateUnits);
actualHeightInput.addEventListener("input", updateActualHeightMessage);

renderPhotoCards();
updateUnits();
updateActualHeightMessage();
