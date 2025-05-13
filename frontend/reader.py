import os

def save_folder_structure_to_file(start_path, output_file):
    """
    Recursively walks through a directory structure and saves it to a text file.
    
    Args:
        start_path (str): Path of the directory to scan
        output_file (str): Path of the output text file
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        for root, dirs, files in os.walk(start_path):
            level = root.replace(start_path, '').count(os.sep)
            indent = ' ' * 4 * (level)
            f.write(f"{indent}{os.path.basename(root)}/\n")
            subindent = ' ' * 4 * (level + 1)
            for file in files:
                f.write(f"{subindent}{file}\n")

if __name__ == "__main__":
    # Get the folder path from user input or use current directory
    folder_path = input("Enter folder path (or press Enter for current directory): ").strip()
    if not folder_path:
        folder_path = os.getcwd()
    
    # Verify the folder exists
    if not os.path.isdir(folder_path):
        print(f"Error: The path '{folder_path}' is not a valid directory.")
        exit(1)
    
    # Set the output file path
    output_path = os.path.join(os.getcwd(), "folder_structure.txt")
    
    print(f"Scanning folder structure of: {folder_path}")
    print(f"Saving to: {output_path}")
    
    save_folder_structure_to_file(folder_path, output_path)
    print("Folder structure saved successfully!")