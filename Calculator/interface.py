from tkinter import *
from functions import buttonPress, equals, clear, navigate_down, navigate_up
import state

window = Tk()
window.title("Scientific Calculator")

# Dark mode colors
bg_color = "#121212"
fg_color = "#e0e0e0"
btn_bg = "#1f1f1f"
btn_fg = "#e0e0e0"
btn_active_bg = "#333333"
btn_active_fg = "#ffffff"
label_bg = "#1e1e1e"
label_fg = "#ffffff"

window.configure(bg=bg_color)

state.equationtxt = ""
state.equationlabel = StringVar(master=window)
state.equationlabel.set("")

label = Label(window,
              textvariable=state.equationlabel,
              font=("Consolas", 20),
              bg=label_bg,
              fg=label_fg,
              relief="sunken",
              bd=5,
              width=40,
              height=13)
label.pack(pady=10)

frame = Frame(window, bg=bg_color)
frame.pack()

# Helper function to add hover effects on buttons
def on_enter(e):
    e.widget['background'] = btn_active_bg
    e.widget['foreground'] = btn_active_fg

def on_leave(e):
    e.widget['background'] = btn_bg
    e.widget['foreground'] = btn_fg

# Create buttons with dark mode styling and hover effect
def create_button(parent, text, row, column, command=None, width=9, height=3, font=("Arial", 16)):
    btn = Button(parent,
                 text=text,
                 height=height,
                 width=width,
                 font=font,
                 bg=btn_bg,
                 fg=btn_fg,
                 activebackground=btn_active_bg,
                 activeforeground=btn_active_fg,
                 relief="raised",
                 command=command)
    btn.grid(row=row, column=column, padx=4, pady=4)
    btn.bind("<Enter>", on_enter)
    btn.bind("<Leave>", on_leave)
    return btn

# Navigation buttons
create_button(frame, "up", 0, 2, navigate_up, height=2)
labelNav = Label(frame, text="History Navigation", font=("Arial", 12, "bold"), bg=bg_color, fg=fg_color)
labelNav.grid(row=1, column=2, pady=5)
create_button(frame, "dn", 2, 2, navigate_down, height=2)

# Numerical buttons
nums = [
    (1, 3, 0), (2, 3, 1), (3, 3, 2),
    (4, 4, 0), (5, 4, 1), (6, 4, 2),
    (7, 5, 0), (8, 5, 1), (9, 5, 2),
    (0, 6, 1)
]
for (num, r, c) in nums:
    create_button(frame, str(num), r, c, lambda x=num: buttonPress(x))

# Basic operator buttons
operators = [
    ("(", 3, 3), (")", 3, 4),
    ("/", 4, 3), ("x", 4, 4),
    ("+", 5, 3), ("-", 5, 4),
    ("=", 6, 3), ("CLEAR", 6, 4),
    ("ANS", 6, 2), ("PreAns", 6, 0),
    (".", 3, 5), ("x^n", 4, 5),
    ("x^1/n", 5, 5), ("x10^n", 6, 5)
]

commands_map = {
    "x": lambda: buttonPress("*"),
    "x^n": lambda: buttonPress("**"),
    "x^1/n": lambda: buttonPress("**(1/"),
    "x10^n": lambda: buttonPress("*10**"),
    "CLEAR": clear,
    "=": equals,
    "ANS": lambda: buttonPress("answer"),
    "PreAns": lambda: buttonPress("preAnswer"),
    "(": lambda: buttonPress("("),
    ")": lambda: buttonPress(")"),
    "/": lambda: buttonPress("/"),
    "+": lambda: buttonPress("+"),
    "-": lambda: buttonPress("-"),
    ".": lambda: buttonPress("."),
}

for (text, r, c) in operators:
    cmd = commands_map.get(text, lambda t=text: buttonPress(t))
    create_button(frame, text, r, c, cmd)

window.mainloop()
