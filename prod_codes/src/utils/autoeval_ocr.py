import os
import json
import cv2
import torch
import argparse
import matplotlib.pyplot as plt
import pandas as pd
from PIL import Image
from transformers import AutoModel, AutoTokenizer
from utils.internvl import load_image, load_prompt

# Set constants
MODEL_PATH = 'OpenGVLab/InternVL3-8B'
MAX_NEW_TOKENS = 1024
EOS_TOKEN_ID = 151645
PAD_TOKEN_ID = 151645


def load_model_and_tokenizer(path=MODEL_PATH):
    print("Loading InternVL model")
    model = AutoModel.from_pretrained(
        path,
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True,
        use_flash_attn=True,
        trust_remote_code=True
    ).eval().cuda()

    tokenizer = AutoTokenizer.from_pretrained(path, trust_remote_code=True, use_fast=False)
    return model, tokenizer


def display_image(image_path):
    img = cv2.imread(image_path)
    plt.figure(figsize=(10, 8))
    plt.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    plt.axis("off")
    plt.title("Input Image")
    plt.show()


def post_process_response(text: str) -> str:
    d = text.lower()
    d = d.replace('json',"")
    d = d.replace('```',"")
    return d


def run_internvl_ocr(image_path):
    model, tokenizer = load_model_and_tokenizer()
    prompt = load_prompt()
    question = "<image>\n" + prompt
    pixel_values = load_image(image_path, max_num=12).to(torch.bfloat16).cuda()

    generation_config = dict(
        max_new_tokens=MAX_NEW_TOKENS,
        do_sample=True,
        eos_token_id=EOS_TOKEN_ID,
        pad_token_id=PAD_TOKEN_ID
    )

    print("Running OCR using InternVL...")
    response = model.chat(tokenizer, pixel_values, question, generation_config)
    cleaned_response = post_process_response(response)

    try:
        parsed_data = json.loads(cleaned_response)
        df = pd.DataFrame(parsed_data)
        return df
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Run InternVL OCR on given image.")
    parser.add_argument('--image_path', type=str, required=True, help="Path to the image file")
    args = parser.parse_args()

    image_path = args.image_path
    if not os.path.exists(image_path):
        print(f"Image file not found: {image_path}")
        return

    display_image(image_path)
    df = run_internvl_ocr(image_path)

    if df is not None:
        print("\nExtracted Fields:")
        print(df.to_string(index=False))
    else:
        print("OCR failed or returned invalid response.")


if __name__ == "__main__":
    main()
