document.addEventListener('DOMContentLoaded', () => {
    // --- API KEY ---
    // IMPORTANT: Add your API key here. It will be used for all AI calls.
    const API_KEY = "AIzaSyCkDWlEwCfcz2FBN4eIuGk8RBRgMNebUck";

    // --- DOM ELEMENTS ---
    const uploadBox = document.getElementById('upload-box');
    const uploadInput = document.getElementById('upload-input');
    const imageDisplayContainer = document.getElementById('image-display-container');
    const displayedImage = document.getElementById('displayed-image');
    const hotspotsContainer = document.getElementById('hotspots-container');
    const recommendationsList = document.getElementById('recommendations-list');
    const loader = document.querySelector('.recommendations-panel .loader');
    const resetBtn = document.getElementById('reset-btn');
    
    let uploadedImageBase64 = null;

    function resetApp() {
        uploadBox.style.display = 'flex';
        imageDisplayContainer.style.display = 'none';
        displayedImage.src = '';
        hotspotsContainer.innerHTML = '';
        // Re-create the placeholder on reset
        recommendationsList.innerHTML = '<p id="recommendations-placeholder">Upload an image to begin your UXorcism.</p>';
        resetBtn.classList.add('hidden');
        uploadInput.value = '';
        uploadedImageBase64 = null;
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
            uploadedImageBase64 = imageUrl.split(',')[1];
            
            displayedImage.src = imageUrl;
            uploadBox.style.display = 'none';
            imageDisplayContainer.style.display = 'flex';
            runAnalysis(uploadedImageBase64);
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
                <div class="card-footer">
                    <button class="suggest-fix-btn">Suggest a Fix</button>
                </div>
                <div class="solution-container"></div>
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

    recommendationsList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('suggest-fix-btn')) {
            const button = event.target;
            const card = button.closest('.recommendation-card');
            const solutionContainer = card.querySelector('.solution-container');
            
            button.disabled = true;
            button.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

            const problemTitle = card.querySelector('h3').textContent;
            const problemRec = card.querySelector('.card-body p').textContent;

            try {
                const solution = await getSolutionFromAI(problemTitle, problemRec, uploadedImageBase64);
                
                let solutionHTML = '';
                if (solution.colorSuggestions && solution.colorSuggestions.length > 0) {
                    solutionHTML += '<h4>Color Suggestions:</h4>';
                    solution.colorSuggestions.forEach(cs => {
                        solutionHTML += `
                            <div class="color-suggestion">
                                <div class="color-swatch" style="background-color: ${cs.background};"></div>
                                <span>BG: ${cs.background}</span>
                                <div class="color-swatch" style="background-color: ${cs.foreground};"></div>
                                <span>Text: ${cs.foreground}</span>
                            </div>
                        `;
                    });
                }
                if (solution.microcopySuggestions && solution.microcopySuggestions.length > 0) {
                     solutionHTML += '<h4>Microcopy Suggestions:</h4>';
                     solution.microcopySuggestions.forEach(ms => {
                        solutionHTML += `<p class="microcopy-suggestion">"${ms}"</p>`;
                     });
                }

                if (solutionHTML === '') {
                    solutionHTML = '<p style="color:var(--text-dark);">The AI could not generate a specific fix for this item.</p>';
                }

                solutionContainer.innerHTML = solutionHTML;
                button.style.display = 'none';

            } catch (error) {
                console.error("Error getting solution:", error);
                solutionContainer.innerHTML = `<p style="color:var(--error-color);">Could not generate a suggestion. Please check the console.</p>`;
                button.disabled = false;
                button.textContent = 'Suggest a Fix';
            }
        }
    });

    async function getSolutionFromAI(problemTitle, problemRec, imageBase64) {
         const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
         const systemPrompt = `You are a helpful UX design assistant. You will be given a UI screenshot and a description of a specific UX problem found on it. Your task is to provide concrete, actionable solutions for that single problem.`;
         const userPrompt = `The user uploaded a UI screenshot. A UX issue was identified: "${problemTitle} - ${problemRec}". Based on this specific issue and the provided image, suggest concrete fixes. Provide up to 2 color suggestions (background and foreground hex codes) that improve contrast or alignment with best practices, and suggest 1-2 improved microcopy options (e.g., better button text).`;
         
         const payload = {
            contents: [{
                parts: [
                    { text: userPrompt },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "colorSuggestions": {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: { "background": { "type": "STRING" }, "foreground": { "type": "STRING" } }
                            }
                        },
                        "microcopySuggestions": { "type": "ARRAY", "items": { "type": "STRING" } }
                    }
                }
            }
         };
         const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
         if (!response.ok) {
             const errorBody = await response.text();
             console.error("Solution API Error:", errorBody);
             throw new Error(`HTTP Error: ${response.status}`);
         }
         const result = await response.json();
         const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
         if (!jsonText) { throw new Error("AI response was empty or malformed."); }
         try {
            return JSON.parse(jsonText);
         } catch (e) {
            console.error("Failed to parse solution JSON:", jsonText);
            throw new Error("AI returned invalid JSON for the solution.");
         }
    }

    async function runAnalysis(imageBase64) {
        const placeholder = document.getElementById('recommendations-placeholder');
        if (placeholder) placeholder.classList.add('hidden');
        loader.classList.remove('hidden');
        recommendationsList.innerHTML = '';
        hotspotsContainer.innerHTML = '';

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
        const systemPrompt = "You are a world-class UX/UI design expert. Your task is to analyze the provided screenshot of a user interface. Based on established usability principles, primarily Jakob Nielsen's 10 Usability Heuristics, identify up to 5 key areas of feedback. For each point, provide a short title, a concise recommendation, classify it as 'good', 'improvement', or 'critical', and estimate the (x, y) coordinates of the relevant element as percentages from the top-left corner of the image.";
        const payload = {
            contents: [{
                parts: [
                    { text: "Analyze this UI screenshot." },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
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
                                "properties": { "x": { "type": "STRING" }, "y": { "type": "STRING" } }
                            }
                        }
                    }
                }
            }
        };

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorBody = await response.text();
                console.error("API Error Response:", errorBody);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) {
                throw new Error("AI response was empty or malformed.");
            }
             try {
                const parsedJson = JSON.parse(jsonText);
                displayResults(parsedJson);
            } catch (e) {
                console.error("Failed to parse analysis JSON:", jsonText);
                throw new Error("AI returned invalid JSON for the analysis.");
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            recommendationsList.innerHTML = `<p>Sorry, the analysis could not be completed. Please check the console for details.</p>`;
        } finally {
            loader.classList.add('hidden');
            resetBtn.classList.remove('hidden');
        }
    }
});

