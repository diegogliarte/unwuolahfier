import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
import {PDFDocument} from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const pdfGrid = document.getElementById('pdf-grid');
const downloadButton = document.getElementById('download-button');

const CROPPED_LEFT = 0.125;
const CROPPED_TOP = 0.125;
const CROPPED_BOTTOM = 0.1;

let modifiedPages = [];
let originalPDFData = null;
let originalFileName = null;

// Prevent default behavior for drag/drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, e => e.preventDefault());
    dropArea.addEventListener(event, e => e.stopPropagation());
});

// Highlight drop area on drag
['dragenter', 'dragover'].forEach(event => {
    dropArea.addEventListener(event, () => dropArea.classList.add('highlight'));
});
['dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, () => dropArea.classList.remove('highlight'));
});

// Handle file drop
dropArea.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// Handle file browse
dropArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
    const files = e.target.files;
    handleFiles(files);
});

// Handle files
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            originalFileName = file.name.replace('.pdf', '');
            reader.onload = () => {
                originalPDFData = reader.result;
                displayPDF(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert(`${file.name} is not a PDF file.`);
        }
    });
}

// Display PDFs in grid
async function displayPDF(dataURL) {
    const pdf = await pdfjsLib.getDocument(dataURL).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale: 1});

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        await page.render({canvasContext: context, viewport: viewport}).promise;

        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-item';
        pageDiv.appendChild(canvas);

        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        pageDiv.appendChild(overlay);

        let clickCount = 0;
        pageDiv.addEventListener('click', () => {
            clickCount = (clickCount + 1) % 3;
            updateClasses(pageDiv, clickCount);
            updatePageState(i, clickCount);
        });

        pdfGrid.appendChild(pageDiv);
    }
    downloadButton.classList.remove('hidden');
}

// Update classes and state
function updateClasses(pageDiv, clickCount) {
    const overlay = pageDiv.querySelector('.overlay');
    overlay.innerHTML = ''; // Clear existing text

    pageDiv.classList.remove('remove', 'trim');
    if (clickCount === 1) {
        pageDiv.classList.add('remove');
        overlay.innerHTML = '<span>REMOVE</span>';
    } else if (clickCount === 2) {
        pageDiv.classList.add('trim');
        overlay.innerHTML = '<span>TRIM</span>';
    }
}

function updatePageState(pageIndex, clickCount) {
    const existing = modifiedPages.find(mod => mod.pageIndex === pageIndex);
    if (existing) {
        if (clickCount === 0) {
            modifiedPages = modifiedPages.filter(mod => mod.pageIndex !== pageIndex);
        } else {
            existing.action = clickCount === 1 ? 'remove' : 'trim';
        }
    } else if (clickCount !== 0) {
        modifiedPages.push({pageIndex, action: clickCount === 1 ? 'remove' : 'trim'});
    }
}

// Download modified PDF
downloadButton.addEventListener('click', async () => {
    if (!originalPDFData) return;

    const originalPdfDoc = await PDFDocument.load(originalPDFData);
    const newPdfDoc = await PDFDocument.create();

    const totalPages = originalPdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
        const modification = modifiedPages.find(mod => mod.pageIndex === i + 1);

        if (modification?.action === 'remove') continue;

        const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [i]);

        const { width, height } = copiedPage.getSize();

        if (modification?.action === 'trim') {
            // First upscales the image to a bigger size (the uncropped area will be equal to the original size),
            // then crops the image to the desired size

            const newWidth = width / (1 - CROPPED_LEFT);
            const newHeight = height / (1 - CROPPED_TOP);

            const scaleX = newWidth / width;
            const scaleY = newHeight / height;

            copiedPage.setSize(newWidth, newHeight); // Creates white borders around the page
            copiedPage.scaleContent(scaleX, scaleY); // Scales the content to fill the page, effectively removing the white borders

            const left_margin = newWidth * CROPPED_LEFT;
            const top_margin = newHeight * CROPPED_TOP;
            const bottom_margin = newHeight * CROPPED_BOTTOM;

            copiedPage.setCropBox( // Crops the left and top margins
                left_margin,
                bottom_margin,
                newWidth - left_margin,
                newHeight - top_margin - bottom_margin
            );
        } else {
            const bottom_margin = height * CROPPED_BOTTOM;
            copiedPage.setCropBox(
                0,
                bottom_margin,
                width,
                height - bottom_margin
            );
        }

        newPdfDoc.addPage(copiedPage);
    }

    const pdfBytes = await newPdfDoc.save();
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${originalFileName}_unwuolahfied.pdf`;
    link.click();
});
