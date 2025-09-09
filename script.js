document.addEventListener('DOMContentLoaded', () => {
    const uploadBox = document.getElementById('upload-box');
    const uploadInput = document.getElementById('upload-input');
    const imageDisplayContainer = document.getElementById('image-display-container');
    const displayedImage = document.getElementById('displayed-image');
    const hotspotsContainer = document.getElementById('hotspots-container');
    const recommendationsList = document.getElementById('recommendations-list');
    const placeholder = document.getElementById('recommendations-placeholder');
    const loader = document.querySelector('.recommendations-panel .loader');
    const resetBtn = document.getElementById('reset-btn');

    function resetApp() {
        uploadBox.style.display = 'flex';
        imageDisplayContainer.style.display = 'none';
        displayedImage.src = '';
        hotspotsContainer.innerHTML = '';
        recommendationsList.innerHTML = '<p id="recommendations-placeholder">Upload an image to begin your UX analysis.</p>';
        if (placeholder) placeholder.classList.remove('hidden');
        resetBtn.classList.add('hidden');
        uploadInput.value = '';
    }

    resetBtn.addEventListener('click', resetApp);

    uploadBox.addEventListener('click', () => uploadInput.click());
    uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('dragover'); });
    uploadBox.addEventListener('dragleave', () => { uploadBox.classList.remove('dragover'); });
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });
    uploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
    
    async function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            const imageBase64 = imageUrl.split(',')[1];
            
            displayedImage.src = imageUrl;
            uploadBox.style.display = 'none';
            imageDisplayContainer.style.display = 'flex';
            runAnalysis(imageBase64);
        };
        reader.readAsDataURL(file);
    }

    function displayResults(results) {
        recommendationsList.innerHTML = '';
        hotspotsContainer.innerHTML = '';

        if (!results || results.length === 0) {
            recommendationsList.innerHTML = '<p>The AI couldn\'t find any specific UX issues. Try another image!</p>';
            return;
        }

        results.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `recommendation-card type-${item.type || 'improvement'}`;
            card.dataset.hotspotId = `hotspot-${index + 1}`;
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-number">${index + 1}</div>
                    <h3>${item.title}</h3>
                </div>
                <div class="card-body">
                    <p>${item.recommendation}</p>
                </div>
            `;
            recommendationsList.appendChild(card);

            const hotspot = document.createElement('div');
            hotspot.className = 'hotspot';
            hotspot.id = `hotspot-${index + 1}`;
            hotspot.textContent = index + 1;
            hotspot.style.left = item.position.x;
            hotspot.style.top = item.position.y;
            hotspotsContainer.appendChild(hotspot);

            hotspot.addEventListener('mouseover', () => card.classList.add('active'));
            hotspot.addEventListener('mouseleave', () => card.classList.remove('active'));
            card.addEventListener('mouseover', () => hotspot.classList.add('active'));
            card.addEventListener('mouseleave', () => hotspot.classList.remove('active'));
        });
    }

    async function runAnalysis(imageBase64) {
        if (placeholder) placeholder.classList.add('hidden');
        loader.classList.remove('hidden');
        recommendationsList.innerHTML = '';
        hotspotsContainer.innerHTML = '';

        const apiKey = "AIzaSyCkDWlEwCfcz2FBN4eIuGk8RBRgMNebUck"; // IMPORTANT: Add your API key here
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const systemPrompt = "You are a world-class UX/UI design expert. Your task is to analyze the provided screenshot of a user interface. Based on established usability principles, primarily Jakob Nielsen's 10 Usability Heuristics, identify up to 5 key areas of feedback. For each point, provide a short title, a concise recommendation, classify it as 'good', 'improvement', or 'critical', and estimate the (x, y) coordinates of the relevant element as percentages from the top-left corner of the image.";

        const payload = {
            contents: [{
                parts: [
                    { text: "Analyze this UI screenshot." },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "title": { "type": "STRING" },
                            "recommendation": { "type": "STRING" },
                            "type": { "type": "STRING", "enum": ["good", "improvement", "critical"] },
                            "position": {
                                "type": "OBJECT",
                                "properties": {
                                    "x": { "type": "STRING" },
                                    "y": { "type": "STRING" }
                                }
                            }
                        }
                    }
                }
            }
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("API Error Response:", errorBody);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            const jsonText = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(jsonText);
            displayResults(parsedJson);

        } catch (error) {
            console.error("Analysis failed:", error);
            recommendationsList.innerHTML = `<p>Sorry, the analysis could not be completed. Please check the console for details.</p>`;
        } finally {
            loader.classList.add('hidden');
            resetBtn.classList.remove('hidden');
        }
    }
});

