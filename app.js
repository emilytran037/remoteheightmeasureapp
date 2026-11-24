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
const zoomedPhotoStage = document.querySelector("#zoomed-photo-stage");
const zoomedPhoto = document.querySelector("#zoomed-photo");
const photoDialogCaption = document.querySelector("#photo-dialog-caption");

let nextPhotoId = 1;
const photos = Array.from({ length: MIN_PHOTOS }, () => createPhotoSlot());
let noticeTimeout;
let zoomedPhotoId = null;
let activePointDrag = null;

function createPhotoSlot() {
  return {
    id: nextPhotoId++,
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    topPoint: null,
    bottomPoint: null,
    activePoint: "top",
    distanceFromPhoto1: "",
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

function renderPointMarker(photo, type) {
  const point = photo[`${type}Point`];
  if (!point || !photo.imageWidth || !photo.imageHeight) {
    return "";
  }

  const label = type === "top" ? "Top" : "Bottom";

  return `<button class="point-marker point-marker-${type}" type="button" data-photo-id="${photo.id}" data-point-marker="${type}" aria-label="${label} point, ${point.x} pixels from the left and ${point.y} pixels from the top"></button>`;
}

function positionPointMarkers(photo, stage) {
  const image = stage?.querySelector("img");
  if (!image || !photo.imageWidth || !photo.imageHeight) {
    return;
  }

  const imageRect = image.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const scale = Math.min(imageRect.width / photo.imageWidth, imageRect.height / photo.imageHeight);
  if (!scale || !stageRect.width || !stageRect.height) {
    return;
  }

  const contentWidth = photo.imageWidth * scale;
  const contentHeight = photo.imageHeight * scale;
  const offsetX = (imageRect.width - contentWidth) / 2;
  const offsetY = (imageRect.height - contentHeight) / 2;

  ["top", "bottom"].forEach((type) => {
    const point = photo[`${type}Point`];
    const marker = stage.querySelector(`[data-point-marker="${type}"]`);
    if (!point || !marker) {
      return;
    }

    marker.style.left = `${((imageRect.left - stageRect.left + offsetX + point.x * scale) / stageRect.width) * 100}%`;
    marker.style.top = `${((imageRect.top - stageRect.top + offsetY + point.y * scale) / stageRect.height) * 100}%`;
  });
}

function renderZoomPhotoMarkers() {
  const photo = photos.find((item) => item.id === zoomedPhotoId);
  if (!photo || !photoDialog.open) {
    return;
  }

  zoomedPhotoStage.querySelectorAll(".point-marker").forEach((marker) => marker.remove());
  zoomedPhotoStage.insertAdjacentHTML("beforeend", `${renderPointMarker(photo, "top")}${renderPointMarker(photo, "bottom")}`);
  positionPointMarkers(photo, zoomedPhotoStage);
}

function getDisplayedImageBounds(photo, image) {
  const imageRect = image.getBoundingClientRect();
  const scale = Math.min(imageRect.width / photo.imageWidth, imageRect.height / photo.imageHeight);
  const width = photo.imageWidth * scale;
  const height = photo.imageHeight * scale;

  return {
    left: imageRect.left + (imageRect.width - width) / 2,
    top: imageRect.top + (imageRect.height - height) / 2,
    width,
    height,
    scale,
  };
}

function pointAtPointer(photo, image, clientX, clientY, clampToImage) {
  const bounds = getDisplayedImageBounds(photo, image);
  if (!bounds.scale || !bounds.width || !bounds.height) {
    return null;
  }

  let offsetX = clientX - bounds.left;
  let offsetY = clientY - bounds.top;
  if (!clampToImage && (offsetX < 0 || offsetY < 0 || offsetX >= bounds.width || offsetY >= bounds.height)) {
    return null;
  }

  offsetX = Math.max(0, Math.min(offsetX, bounds.width));
  offsetY = Math.max(0, Math.min(offsetY, bounds.height));

  return {
    x: Math.min(photo.imageWidth - 1, Math.round(offsetX / bounds.scale)),
    y: Math.min(photo.imageHeight - 1, Math.round(offsetY / bounds.scale)),
  };
}

function updatePhotoMarkerPositions(photo) {
  document.querySelectorAll(`.point-marker[data-photo-id="${photo.id}"]`).forEach((marker) => {
    positionPointMarkers(photo, marker.closest("[data-point-stage]"));
  });
}

function selectPhotoPoint(photoId, type) {
  const photo = photos.find((item) => item.id === photoId);
  if (photo) {
    photo.activePoint = type;
    renderPhotoCards();
  }
}

function openPhotoZoom(photo) {
  zoomedPhotoId = photo.id;
  zoomedPhotoStage.dataset.pointStage = photo.id;
  zoomedPhoto.src = photo.imageUrl;
  zoomedPhoto.alt = `Photo ${photos.indexOf(photo) + 1}`;
  photoDialogCaption.textContent = `Photo ${photos.indexOf(photo) + 1}`;
  photoDialog.showModal();
  renderZoomPhotoMarkers();
}

function renderPhotoPointControls(photo, position) {
  if (!photo.imageUrl) {
    return "";
  }

  const pointsReady = Boolean(photo.imageWidth && photo.imageHeight);
  const selectedCount = Number(Boolean(photo.topPoint)) + Number(Boolean(photo.bottomPoint));
  const pointStatus = `${selectedCount} of 2 points selected`;
  const activeLabel = photo.activePoint === "top" ? "Top point" : "Bottom point";

  return `
    <div class="point-selection">
      <div class="point-selectors" role="group" aria-label="Select a point for Photo ${position}">
        <div class="point-row">
          <button class="point-selector point-selector-top${photo.activePoint === "top" ? " is-active" : ""}" type="button" data-photo-id="${photo.id}" data-select-point="top" aria-pressed="${photo.activePoint === "top"}"${pointsReady ? "" : " disabled"}>
            <span class="point-selector-name"><span class="point-color-swatch point-color-swatch-top"></span>Top</span>
            <strong>${photo.topPoint ? "Selected" : "Missing"}</strong>
          </button>
          <button class="delete-point-button" type="button" data-photo-id="${photo.id}" data-delete-point="top" aria-label="Delete top point from Photo ${position}"${photo.topPoint ? "" : " disabled"}>Delete</button>
        </div>
        <div class="point-row">
          <button class="point-selector point-selector-bottom${photo.activePoint === "bottom" ? " is-active" : ""}" type="button" data-photo-id="${photo.id}" data-select-point="bottom" aria-pressed="${photo.activePoint === "bottom"}"${pointsReady ? "" : " disabled"}>
            <span class="point-selector-name"><span class="point-color-swatch point-color-swatch-bottom"></span>Bottom</span>
            <strong>${photo.bottomPoint ? "Selected" : "Missing"}</strong>
          </button>
          <button class="delete-point-button" type="button" data-photo-id="${photo.id}" data-delete-point="bottom" aria-label="Delete bottom point from Photo ${position}"${photo.bottomPoint ? "" : " disabled"}>Delete</button>
        </div>
      </div>
      <p class="active-point">${pointsReady ? `Currently selecting: ${activeLabel}. Tap or click the photo to place or move it.` : "Preparing the photo for point selection…"}</p>
      <div class="point-progress"><span>${pointStatus}</span></div>
    </div>`;
}

function renderPhotoCards() {
  photoList.innerHTML = "";

  photos.forEach((photo, index) => {
    const position = index + 1;
    if (position === 1) {
      photo.distanceFromPhoto1 = "0";
    }

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
          ? `<div class="photo-stage" data-point-stage="${photo.id}">
              <img src="${photo.imageUrl}" data-photo-image="${photo.id}" alt="Photo ${position}" draggable="false">
              ${renderPointMarker(photo, "top")}
              ${renderPointMarker(photo, "bottom")}
              <button class="zoom-label" type="button" data-zoom-photo="${photo.id}" aria-label="Zoom in on Photo ${position}">Tap to zoom</button>
            </div>
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
      <div class="photo-position-info">
        ${
          position === 1
            ? `<div class="baseline-note">Leftmost photo · Starting position</div>`
            : `<label class="distance-field" for="distance-${position}">
              Distance from Photo 1
              <span class="distance-input-wrap">
                <input class="distance-input" id="distance-${position}" name="distance-${position}" data-distance-input="${photo.id}" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 15">
                <span class="distance-unit">${unitsSelect.value}</span>
              </span>
              </label>`
        }
      </div>
      ${photo.imageUrl ? renderPhotoPointControls(photo, position) : ""}`;
    photoList.append(card);
    positionPointMarkers(photo, card.querySelector(".photo-stage"));
    const distanceInput = card.querySelector(".distance-input");
    if (distanceInput) {
      distanceInput.value = photo.distanceFromPhoto1;
    }
  });

  photoCount.textContent = `${photos.length} of ${MAX_PHOTOS} photos`;
  addPhotoButton.disabled = photos.length >= MAX_PHOTOS;
  updateUnits();
  updatePointSelectionSummary();
  renderZoomPhotoMarkers();
}

function updatePointSelectionSummary() {
  const summary = document.querySelector("#point-selection-summary");
  const uploadedPhotos = photos.filter((photo) => photo.imageUrl);
  const completedPhotos = uploadedPhotos.filter((photo) => photo.topPoint && photo.bottomPoint);
  const isComplete = uploadedPhotos.length >= MIN_PHOTOS && completedPhotos.length === uploadedPhotos.length;

  summary.classList.toggle("is-complete", isComplete);
  if (isComplete) {
    summary.textContent = `Point selection complete for all ${uploadedPhotos.length} uploaded photos.`;
  } else if (uploadedPhotos.length < MIN_PHOTOS) {
    summary.textContent = `Upload at least ${MIN_PHOTOS} photos to complete point selection (${uploadedPhotos.length} uploaded).`;
  } else {
    summary.textContent = `${completedPhotos.length} of ${uploadedPhotos.length} uploaded photos have both points selected.`;
  }
}

function getPhotoMeasurementData() {
  return photos
    .map((photo, index) => ({ photo, position: index + 1 }))
    .filter(({ photo }) => photo.imageUrl)
    .map(({ photo, position }) => ({
      id: photo.id,
      position,
      imageWidth: photo.imageWidth,
      imageHeight: photo.imageHeight,
      topPoint: photo.topPoint ? { ...photo.topPoint } : null,
      bottomPoint: photo.bottomPoint ? { ...photo.bottomPoint } : null,
      distanceFromPhoto1: position === 1
        ? 0
        : photo.distanceFromPhoto1 === "" ? null : Number(photo.distanceFromPhoto1),
    }));
}

function showNotice(message) {
  window.clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.classList.add("is-visible");
  noticeTimeout = window.setTimeout(() => {
    notice.classList.remove("is-visible");
  }, 3200);
}

window.getPhotoMeasurementData = getPhotoMeasurementData;

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

document.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const stage = event.target.closest("[data-point-stage]");
  if (!stage) {
    return;
  }

  const photoId = Number(stage.dataset.pointStage);
  const photo = photos.find((item) => item.id === photoId);
  const marker = event.target.closest(".point-marker");
  if (marker && photo) {
    const type = marker.dataset.pointMarker;
    photo.activePoint = type;
    activePointDrag = {
      photo,
      type,
      pointerId: event.pointerId,
      image: stage.querySelector("img"),
    };
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }

  if (event.target.closest("button")) {
    return;
  }

  const image = stage.querySelector("img");
  if (!photo || !image || !photo.imageWidth || !photo.imageHeight) {
    return;
  }

  const point = pointAtPointer(photo, image, event.clientX, event.clientY, false);
  if (!point) {
    return;
  }

  photo[`${photo.activePoint}Point`] = point;

  if (photo.activePoint === "top" && !photo.bottomPoint) {
    photo.activePoint = "bottom";
  }

  renderPhotoCards();
});

document.addEventListener("pointermove", (event) => {
  if (!activePointDrag || event.pointerId !== activePointDrag.pointerId) {
    return;
  }

  const { photo, type, image } = activePointDrag;
  const point = pointAtPointer(photo, image, event.clientX, event.clientY, true);
  if (!point) {
    return;
  }

  photo[`${type}Point`] = point;
  updatePhotoMarkerPositions(photo);
});

function finishPointDrag(event) {
  if (!activePointDrag || event.pointerId !== activePointDrag.pointerId) {
    return;
  }

  activePointDrag = null;
  renderPhotoCards();
}

document.addEventListener("pointerup", finishPointDrag);
document.addEventListener("pointercancel", finishPointDrag);

photoList.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!target) {
    return;
  }

  if (target.dataset.selectPoint) {
    const photo = photos.find((item) => item.id === Number(target.dataset.photoId));
    if (photo) {
      photo.activePoint = target.dataset.selectPoint;
      renderPhotoCards();
    }
    return;
  }

  if (target.dataset.pointMarker) {
    selectPhotoPoint(Number(target.dataset.photoId), target.dataset.pointMarker);
    return;
  }

  if (target.dataset.deletePoint) {
    const photo = photos.find((item) => item.id === Number(target.dataset.photoId));
    if (photo) {
      photo[`${target.dataset.deletePoint}Point`] = null;
      photo.activePoint = target.dataset.deletePoint;
      renderPhotoCards();
    }
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
    openPhotoZoom(photo);
    return;
  }

  if (target.dataset.deletePhoto && photo?.imageUrl) {
    URL.revokeObjectURL(photo.imageUrl);
    photo.imageUrl = null;
    photo.imageWidth = null;
    photo.imageHeight = null;
    photo.topPoint = null;
    photo.bottomPoint = null;
    photo.activePoint = "top";
    renderPhotoCards();
    showNotice("Photo deleted.");
    return;
  }

  if (target.dataset.removePosition && photo) {
    if (photos.length <= MIN_PHOTOS) {
      showNotice("At least two photo positions are needed for a measurement.");
      return;
    }

    const removedIndex = photos.indexOf(photo);
    if (removedIndex === 0) {
      const newBaselineDistance = photos[1].distanceFromPhoto1;
      const baselineIsValid = newBaselineDistance !== "" && Number.isFinite(Number(newBaselineDistance));
      photos.slice(2).forEach((remainingPhoto) => {
        const distance = remainingPhoto.distanceFromPhoto1;
        if (baselineIsValid && distance !== "" && Number.isFinite(Number(distance)) && Number(distance) >= Number(newBaselineDistance)) {
          remainingPhoto.distanceFromPhoto1 = String(Number(distance) - Number(newBaselineDistance));
        } else {
          remainingPhoto.distanceFromPhoto1 = "";
        }
      });
    }

    if (photo.imageUrl) {
      URL.revokeObjectURL(photo.imageUrl);
    }
    photos.splice(removedIndex, 1);
    renderPhotoCards();
    showNotice("Position removed. Review the remaining distances.");
  }
});

photoList.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains("distance-input")) {
    return;
  }

  const photo = photos.find((item) => item.id === Number(input.dataset.distanceInput));
  if (photo) {
    photo.distanceFromPhoto1 = input.value;
  }
});

photoList.addEventListener("load", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.dataset.photoImage) {
    return;
  }

  const photo = photos.find((item) => item.id === Number(image.dataset.photoImage));
  if (!photo || photo.imageWidth === image.naturalWidth && photo.imageHeight === image.naturalHeight) {
    return;
  }

  photo.imageWidth = image.naturalWidth;
  photo.imageHeight = image.naturalHeight;
  renderPhotoCards();
}, true);

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

  const previousImageUrl = photo.imageUrl;
  const imageUrl = URL.createObjectURL(file);
  photo.imageUrl = imageUrl;
  photo.imageWidth = null;
  photo.imageHeight = null;
  photo.topPoint = null;
  photo.bottomPoint = null;
  photo.activePoint = "top";

  if (previousImageUrl) {
    URL.revokeObjectURL(previousImageUrl);
  }

  const image = new Image();
  image.onload = () => {
    if (photo.imageUrl !== imageUrl) {
      URL.revokeObjectURL(imageUrl);
      return;
    }
    photo.imageWidth = image.naturalWidth;
    photo.imageHeight = image.naturalHeight;
    renderPhotoCards();
    showNotice("Photo selected. Select its top and bottom points.");
  };
  image.onerror = () => {
    if (photo.imageUrl !== imageUrl) {
      URL.revokeObjectURL(imageUrl);
      return;
    }
    URL.revokeObjectURL(imageUrl);
    photo.imageUrl = null;
    photo.imageWidth = null;
    photo.imageHeight = null;
    renderPhotoCards();
    showNotice("The selected image could not be loaded. Choose another image.");
  };
  image.src = imageUrl;
  renderPhotoCards();
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
  const marker = event.target instanceof Element ? event.target.closest(".point-marker") : null;
  if (marker) {
    selectPhotoPoint(Number(marker.dataset.photoId), marker.dataset.pointMarker);
  }
});

photoDialog.addEventListener("click", (event) => {
  if (event.target === photoDialog) {
    photoDialog.close();
  }
});

photoDialog.addEventListener("close", () => {
  zoomedPhotoId = null;
});

unitsSelect.addEventListener("change", updateUnits);
actualHeightInput.addEventListener("input", updateActualHeightMessage);

renderPhotoCards();
updateUnits();
updateActualHeightMessage();
