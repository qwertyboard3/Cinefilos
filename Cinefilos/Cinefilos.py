import requests
import tkinter as tk
from tkinter import ttk, filedialog
from PIL import Image, ImageTk
import io
import os
import ctypes
import re

API_KEY = "f05a8ae7"

# ---------------- PATHS (ABSOLUTE & SAFE) ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
POSTERS_DIR = os.path.join(ASSETS_DIR, "posters")

os.makedirs(POSTERS_DIR, exist_ok=True)

ENTRIES_JS = os.path.join(ASSETS_DIR, "entries.js")
POSTERS_JS = os.path.join(ASSETS_DIR, "posters.js")
RUNTIME_JS = os.path.join(ASSETS_DIR, "runtime.js")
TITLES_JS = os.path.join(ASSETS_DIR, "titles.js")

# ---------------- DATA ----------------
entries_data = []
current_selected = None
results_imdb_ids = {}
added_movies_ids = {}

# ---------------- GLASS EFFECT ----------------
def apply_glass_effect(window):
    try:
        hwnd = window.winfo_id()

        class ACCENTPOLICY(ctypes.Structure):
            _fields_ = [("AccentState", ctypes.c_int),
                        ("AccentFlags", ctypes.c_int),
                        ("GradientColor", ctypes.c_uint),
                        ("AnimationId", ctypes.c_int)]

        class WINDOWCOMPOSITIONATTRIBDATA(ctypes.Structure):
            _fields_ = [("Attribute", ctypes.c_int),
                        ("Data", ctypes.c_void_p),
                        ("SizeOfData", ctypes.c_size_t)]

        accent = ACCENTPOLICY(3, 0, 0xCC202020, 0)
        data = WINDOWCOMPOSITIONATTRIBDATA(19, ctypes.byref(accent), ctypes.sizeof(accent))
        ctypes.windll.user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))
    except:
        pass

# ---------------- OMDb ----------------
def search_omdb(query):
    return requests.get(
        f"http://www.omdbapi.com/?apikey={API_KEY}&s={query}"
    ).json()

def fetch_details(imdb_id):
    return requests.get(
        f"http://www.omdbapi.com/?apikey={API_KEY}&i={imdb_id}&plot=short"
    ).json()

def fetch_poster(url):
    if not url or url == "N/A":
        return None
    img = Image.open(io.BytesIO(requests.get(url).content))
    img.thumbnail((220, 330))
    return ImageTk.PhotoImage(img)

# ---------------- EVENTS ----------------
def search_movie(event=None):
    results_list.delete(0, tk.END)
    results_imdb_ids.clear()

    query = search_var.get().strip()
    if not query:
        return

    data = search_omdb(query)
    if data.get("Response") == "True":
        for i, m in enumerate(data["Search"]):
            results_list.insert(tk.END, f"{m['Title']} ({m['Year']})")
            results_imdb_ids[i] = m["imdbID"]

def show_movie(imdb_id):
    global current_selected
    data = fetch_details(imdb_id)
    if data.get("Response") != "True":
        return

    current_selected = {
        "title": data["Title"],
        "year": data["Year"],
        "imdbID": imdb_id
    }

    poster = fetch_poster(data.get("Poster"))
    poster_label.config(image=poster, text="")
    poster_label.image = poster

    info_text.config(state="normal")
    info_text.delete("1.0", tk.END)
    info_text.insert(tk.END,
        f"Title: {data['Title']}\n"
        f"Year: {data['Year']}\n"
        f"IMDb ID: {imdb_id}\n"
        f"Runtime: {data.get('Runtime')}\n"
        f"Genre: {data.get('Genre')}\n\n"
        f"{data.get('Plot')}"
    )
    info_text.config(state="disabled")

def select_result(e):
    sel = results_list.curselection()
    if sel:
        show_movie(results_imdb_ids[sel[0]])

def select_added(e):
    sel = added_movies.curselection()
    if sel:
        show_movie(added_movies_ids[sel[0]])

def add_movie():
    if not current_selected:
        return

    for m in entries_data:
        if m["imdbID"] == current_selected["imdbID"]:
            return

    entries_data.append(current_selected.copy())
    idx = added_movies.size()
    added_movies.insert(tk.END, f"{current_selected['title']} ({current_selected['year']})")
    added_movies_ids[idx] = current_selected["imdbID"]

def save_entries():
    with open(ENTRIES_JS, "w", encoding="utf-8") as f:
        f.write("const entries = [\n")
        for m in entries_data:
            f.write(f'  {{ title: "{m["title"]}", imdbID: "{m["imdbID"]}" }},\n')
        f.write("];\n")

def download_assets():
    posters_js = ["const localFallback = {"]
    runtime_js = ["const forcedRuntime = {"]
    titles_js = ["const movieTitles = {"]

    for m in entries_data:
        data = fetch_details(m["imdbID"])
        poster_url = data.get("Poster")

        if poster_url and poster_url != "N/A":
            img = requests.get(poster_url).content
            with open(os.path.join(POSTERS_DIR, f"{m['imdbID']}.jpg"), "wb") as f:
                f.write(img)

        posters_js.append(f'  "{m["imdbID"]}": "posters/{m["imdbID"]}.jpg", // {m["title"]}')
        runtime_js.append(f'  "{m["imdbID"]}": "{data.get("Runtime")}", // {m["title"]}')
        titles_js.append(f'  "{m["imdbID"]}": "{m["title"]}",')

    posters_js.append("};")
    runtime_js.append("};")
    titles_js.append("};")

    open(POSTERS_JS, "w", encoding="utf-8").write("\n".join(posters_js))
    open(RUNTIME_JS, "w", encoding="utf-8").write("\n".join(runtime_js))
    open(TITLES_JS, "w", encoding="utf-8").write("\n".join(titles_js))
    save_entries()

# ---------------- UI ----------------
root = tk.Tk()
root.title("Movie Entry Maker")
root.geometry("1000x620")
root.configure(bg="#121212")
apply_glass_effect(root)

style = ttk.Style()
style.theme_use("clam")
style.configure("TButton", background="#222", foreground="#fff")

menubar = tk.Menu(root)
filemenu = tk.Menu(menubar, tearoff=0)
filemenu.add_command(label="Save entries.js", command=save_entries)
filemenu.add_command(label="Download Assets", command=download_assets)
filemenu.add_separator()
filemenu.add_command(label="Exit", command=root.quit)
menubar.add_cascade(label="File", menu=filemenu)
root.config(menu=menubar)

search_var = tk.StringVar()
search_frame = tk.Frame(root, bg="#121212")
search_frame.pack(pady=10)

entry = tk.Entry(search_frame, textvariable=search_var, font=("Segoe UI", 13),
                 bg="#222", fg="#fff", insertbackground="#fff", relief="flat", width=42)
entry.pack(side=tk.LEFT, padx=6)
entry.bind("<Return>", search_movie)

ttk.Button(search_frame, text="Search", command=search_movie).pack(side=tk.LEFT)

main = tk.Frame(root, bg="#121212")
main.pack(fill=tk.BOTH, expand=True, padx=10)

results_list = tk.Listbox(main, bg="#222", fg="#fff", width=32, height=22)
results_list.pack(side=tk.LEFT)
results_list.bind("<<ListboxSelect>>", select_result)

info = tk.Frame(main, bg="#121212")
info.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=12)

poster_label = tk.Label(info, bg="#121212")
poster_label.pack(pady=6)

info_text = tk.Text(info, bg="#222", fg="#fff", relief="flat", height=16)
info_text.pack(fill=tk.BOTH, expand=True)
info_text.config(state="disabled")

ttk.Button(info, text="Add Movie", command=add_movie).pack(pady=6)
ttk.Button(info, text="Download Assets", command=download_assets).pack()

added_movies = tk.Listbox(main, bg="#222", fg="#fff", width=32, height=22)
added_movies.pack(side=tk.LEFT)
added_movies.bind("<<ListboxSelect>>", select_added)

root.mainloop()
