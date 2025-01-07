import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
import {PDFDocument} from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const pdfContainer = document.getElementById('pdf-container');
const downloadAllBtn = document.getElementById('download-all-button');
downloadAllBtn.addEventListener('click', downloadAllPDFs);


const CROPPED_LEFT = 0.126;
const CROPPED_TOP = 0.125;

let pdfData = [];

// Prevent default drag/drop behavior
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, e => e.preventDefault());
    dropArea.addEventListener(event, e => e.stopPropagation());
});

// Handle file drop
dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

// Handle file browse
dropArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFiles(e.target.files));

// Handle multiple files
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = () => {
                const fileName = file.name.replace('.pdf', '');
                displayPDF(fileName, reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            alert(`${file.name} is not a PDF file.`);
        }
    });
}

// Display a single PDF
async function displayPDF(fileName, dataURL) {
    const pdf = await pdfjsLib.getDocument(dataURL).promise;
    const pdfId = `pdf-${Date.now()}`; // Unique ID for this PDF
    const pages = [];

    // Store PDF data URL for later use
    pdfData.push({id: pdfId, fileName, pages, dataURL});

    // Create a wrapper for the PDF
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-wrapper';
    wrapper.id = pdfId;

    // Create a header for the download and remove buttons
    const header = document.createElement('div');
    header.className = 'pdf-header';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = `Download ${fileName}`;
    downloadBtn.addEventListener('click', () => downloadPDF(fileName, dataURL, pages));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove PDF';
    removeBtn.addEventListener('click', () => {
        wrapper.remove(); // Remove the PDF wrapper
        const index = pdfData.findIndex(p => p.id === pdfId);
        if (index !== -1) {
            pdfData.splice(index, 1); // Remove the PDF from the data array
        }
        toggleDownloadAllButton(); // Update visibility of "Download All PDFs" button
    });

    header.appendChild(downloadBtn);
    header.appendChild(removeBtn);

    const grid = document.createElement('div');
    grid.className = 'pdf-grid';

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

        let action = 'none'; // Default action

        // Apply pre-defined actions
        if (i === 1 || i === 4) {
            action = 'remove';
        } else if (i === 2 || (i >= 6 && (i - 6) % 3 === 0)) {
            action = 'trim';
        }

        applyAction(pageDiv, overlay, action);
        pages.push({pageIndex: i, action});

        pageDiv.addEventListener('click', () => {
            const currentAction = pages.find(p => p.pageIndex === i).action;
            const nextAction = getNextAction(currentAction);
            applyAction(pageDiv, overlay, nextAction);
            pages.find(p => p.pageIndex === i).action = nextAction;
        });

        grid.appendChild(pageDiv);
    }

    wrapper.appendChild(header);
    wrapper.appendChild(grid);

    // Create a separator inside the wrapper
    const separator = document.createElement('hr');
    separator.className = 'pdf-separator';

    wrapper.appendChild(separator);

    // Append the wrapper to the top of the container
    pdfContainer.insertBefore(wrapper, pdfContainer.firstChild);

    toggleDownloadAllButton();
}


// Get the next action in the cycle
function getNextAction(currentAction) {
    if (currentAction === 'none') return 'remove';
    if (currentAction === 'remove') return 'trim';
    return 'none';
}

// Apply an action (remove, trim, or reset) to a page
function applyAction(pageDiv, overlay, action) {
    pageDiv.classList.remove('remove', 'trim');
    overlay.innerHTML = ''; // Clear overlay text

    if (action === 'remove') {
        pageDiv.classList.add('remove');
        overlay.innerHTML = '<span>REMOVE</span>';
    } else if (action === 'trim') {
        pageDiv.classList.add('trim');
        overlay.innerHTML = '<span>TRIM</span>';
    }
}

// Download modified PDF
async function downloadPDF(fileName, dataURL, pages) {
    const originalPdfDoc = await PDFDocument.load(dataURL);
    const newPdfDoc = await PDFDocument.create();

    const totalPages = originalPdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
        const modification = pages.find(mod => mod.pageIndex === i + 1);

        if (modification?.action === 'remove') continue;

        const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [i]);
        const {width, height} = copiedPage.getSize();

        if (modification?.action === 'trim') {
            const newWidth = width / (1 - CROPPED_LEFT);
            const newHeight = height / (1 - CROPPED_TOP);

            const scaleX = newWidth / width;
            const scaleY = newHeight / height;

            copiedPage.setSize(newWidth, newHeight);
            copiedPage.scaleContent(scaleX, scaleY);

            const leftMargin = newWidth * CROPPED_LEFT;
            const topMargin = newHeight * CROPPED_TOP;

            copiedPage.setCropBox(
                leftMargin,
                0,
                newWidth - leftMargin,
                newHeight - topMargin
            );
        }

        newPdfDoc.addPage(copiedPage);
    }

    const pdfBytes = await newPdfDoc.save();
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}_unwuolahfied.pdf`;
    link.click();
}

function toggleDownloadAllButton() {
    const downloadAllBtn = document.getElementById('download-all-button');
    if (pdfData.length > 0) {
        downloadAllBtn.classList.remove('hidden');
    } else {
        downloadAllBtn.classList.add('hidden');
    }
}

async function downloadAllPDFs() {
    for (const pdf of pdfData) {
        const {fileName, pages} = pdf;
        const dataURL = await getPDFDataURL(fileName);
        await downloadPDF(fileName, dataURL, pages);
    }
}

async function getPDFDataURL(fileName) {
    const pdf = pdfData.find(p => p.fileName === fileName);
    if (pdf && pdf.dataURL) {
        return pdf.dataURL;
    }
    return null;
}

