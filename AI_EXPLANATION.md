# 🧠 The Brain Behind SkinScan AI: Avoiding "Black Magic"

This document explains exactly how our Artificial Intelligence works, from the classroom (training) to the real world (your phone). We've broken it down into simple terms for anyone to understand.

---

## Part 1: The Notebook (`skin_cancer_classifier.ipynb`)
Think of this notebook as the **university classroom** where our AI student went to school.

### 1. The "Teacher": Transfer Learning
Training an AI from scratch is like teaching a baby to recognize a melanoma. It takes years and millions of examples.
Instead, we used a technique called **Transfer Learning**.

*   **The Base Model (MobileNetV2)**: We hired an "expert" neural network called **MobileNetV2**. This model had already seen **1.4 million images** (cats, dogs, landscapes, cars) from a huge dataset called ImageNet.
    *   *Analogy*: Imagine hiring a veteran ophthalmologist. They already know how to look closely at eyes, detect edges, and verify textures. They know "how to see."
*   **The Knowledge Transfer**: We took this expert and said, "You know how to see shapes and colors perfectly. Now, use that skill *only* to look at skin lesions."

### 2. The "Classroom": The Layers
We kept the expert's eyes (the base layers) but replaced its brain (the final classification layers) with our own custom ones. Here is the structure we built:

1.  **MobileNetV2 (Frozen Base)**:
    *   This extracts features. It looks at the image and says "I see a jagged edge here, a dark spot there, and red texture here."
2.  **Global Average Pooling**:
    *   This summarizes the findings. Instead of saying "pixel 200x200 is red," it says "overall, this image is reddish and rough."
3.  **Dense Layer (256 Neurons)**:
    *   **The Deep Thinker**. This layer takes all those summaries and looks for complex combinations. "If it's red AND jagged AND asymmetrical, that's bad."
4.  **Dropout (0.5)**:
    *   **The anti-cheating mechanism**. During training, we randomly "turn off" 50% of the neurons.
    *   *Why?* It forces the AI not to memorize specific photos (cheating). It must learn general rules that apply even if some information is missing.
5.  **Dense Layer (128 Neurons)**:
    *   Refining the decision further.
6.  **Dense Layer (1 Output - Sigmoid)**:
    *   **The Final Verdict**. It outputs a single number between 0 and 1.
    *   `0.0` = Perfectly Benign
    *   `1.0` = Perfectly Malignant

### 3. The "Final Exam": Training
We showed the model **3,600 images** (1,800 benign, 1,800 malignant) multiple times (Epochs).
*   **Loss Function**: The score of how wrong it was. The goal is to get this to zero.
*   **Optimizer (Adam)**: The method it uses to adjust its brain to reduce the loss.

At the end, we saved its brain state into a file: `skin_cancer_model.h5`.

---

## Part 2: The Real World (The Web App)
Now that the student has graduated, we hired them to work in our web app (`app.py`).

### 1. Loading the Brain
When you start the Flask server (`python app.py`), the first thing it does is load that `.h5` file. It wakes up the trained expert and keeps it ready in memory.

### 2. The "Receptionist": Preprocessing
When you upload a photo from your phone, we can't just throw it at the AI. Using `app.js` and `app.py`, we act as a receptionist:
1.  **Crop**: We focus only on the lesion (discarding the background).
2.  **Resize**: The AI *only* knows how to look at **224x224** pixel squares. We shrink your photo to match.
3.  **Normalization**: We convert your photo's colors (0-255) to the math format the AI prefers (0.0 - 1.0).

### 3. The Prediction
We pass this prepared square to the loaded model.
*   The model runs the numbers through its layers.
*   It spits out a score, e.g., `0.982`.
*   **Our Logic**:
    *   If score > 0.5: **Label as SUSPICIOUS**
    *   If score <= 0.5: **Label as BENIGN**
    *   Confidence = The distance from 0.5 (e.g., 0.98 is 98% confident).

And that's how we turned pixels into a prediction!
