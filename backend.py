
import argparse
import os
import cv2

import numpy as np

from PIL import Image
from pdf2image import convert_from_path

import pytesseract


def is_exercise_title(text, keywords, word_num):
    return text.strip() in keywords and word_num == 1

def convert_and_stitch_pdf_pages(pdf_path):
    images = convert_from_path(pdf_path)
    cropped_images = []
    for image in images:
        np_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        gray = cv2.cvtColor(np_image, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        
        rows_with_content = np.where(thresh.sum(axis=1) > 0)[0]
        
        if len(rows_with_content) > 0:
            top_crop = rows_with_content[0]
            bottom_crop = rows_with_content[-1] + 1
            cropped_images.append(np_image[top_crop:bottom_crop, :])
        else:
            cropped_images.append(np_image)
            
    max_width = max(img.shape[1] for img in cropped_images)
    padded_images = []
    for img in cropped_images:
        if img.shape[1] < max_width:
            padding = max_width - img.shape[1]
            padded_img = cv2.copyMakeBorder(img, 0, 0, 0, padding, cv2.BORDER_CONSTANT, value=[255, 255, 255])
            padded_images.append(padded_img)
        else:
            padded_images.append(img)

    stitched_image = cv2.vconcat(padded_images)
    return stitched_image

def ocr_image(image):
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    
    boxes = []
    for i in range(len(data['text'])):
        if int(data['conf'][i]) > 60:
            (x, y, w, h) = (data['left'][i], data['top'][i], data['width'][i], data['height'][i])
            text = data['text'][i]
            line_num = data['line_num'][i]
            word_num = data['word_num'][i]
            boxes.append((text, (x, y, x + w, y + h), line_num, word_num))
    return boxes



def detect_exercise_titles(image, keywords):
    ocr_boxes = ocr_image(image)
    
    title_y_coords = []
    for text, box, line_num, word_num in ocr_boxes:
        if is_exercise_title(text, keywords, word_num):
            title_y_coords.append(box[1])

    title_y_coords.sort()
    
    return title_y_coords

def crop_and_save_exercises(image, title_y_coords, output_dir):
    padding_pixels = 30
    output_paths = []

    for i, start_y_original in enumerate(title_y_coords):
        start_y = max(0, start_y_original - padding_pixels)

        end_y = title_y_coords[i + 1] if i + 1 < len(title_y_coords) else image.shape[0]

        cropped_image = image[start_y:end_y, :]

        output_path = os.path.join(output_dir, f"exercise_{i+1}.png")
        cv2.imwrite(output_path, cropped_image)
        output_paths.append(output_path)
    
    # Print file paths for Electron to capture
    print(','.join(output_paths))

    

def main():
    parser = argparse.ArgumentParser(description="Extract exercises from a PDF file.")
    parser.add_argument("--pdf_path", type=str, required=True, help="The path to the input PDF file.")
    parser.add_argument("--output_dir", type=str, required=True, help="The path to the output directory.")
    parser.add_argument("--keywords", type=str, required=True, help="A comma-separated list of keywords to detect.")
    args = parser.parse_args()

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    stitched_image = convert_and_stitch_pdf_pages(args.pdf_path)
    keywords = [k.strip() for k in args.keywords.split(',')]
    title_y_coords = detect_exercise_titles(stitched_image, keywords)
    crop_and_save_exercises(stitched_image, title_y_coords, args.output_dir)

if __name__ == "__main__":
    main()
