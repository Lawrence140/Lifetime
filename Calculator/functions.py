# Calculator functions

import state
def buttonPress(num):
    if state.justEvaluated:
        if isinstance(num, int) or (isinstance(num, str) and num.isdigit()):
            state.equationtxt = "" 
        state.justEvaluated = False
    if num == "answer":
        state.equationtxt=""
        if state.answer is not None:
            state.equationtxt += state.answer
    elif num == "preAnswer":
        state.equationtxt=""
        if state.prevAnswer is not None:
            state.equationtxt += state.prevAnswer
    elif num == "decimal":
        state.equationtxt += "."
    else:
        state.equationtxt += str(num)

    state.equationlabel.set(state.equationtxt)

def equals():
    try:
        total = str(eval(state.equationtxt))

        if state.equationtxt.strip() != "":
            state.history.append(state.equationtxt)
        state.history_idx = len(state.history)

        state.prevAnswer = state.answer
        state.answer = total
        state.equationlabel.set(total)
        state.equationtxt = total
        state.justEvaluated = True  
    except ZeroDivisionError:
        state.equationlabel.set("No division by zero.")
        state.equationtxt=""
        state.justEvaluated = False     
    except SyntaxError:
        state.equationlabel.set("Invalid syntax.")
        state.equationtxt=""

def clear():
    state.equationlabel.set("")
    state.equationtxt=""

def navigate_up():
    if state.history:
        state.history_idx = max(0, state.history_idx - 1)
        state.equationtxt = state.history[state.history_idx]
        state.equationlabel.set(state.equationtxt)

def navigate_down():
    if state.history:
        state.history_idx = min(len(state.history) - 1, state.history_idx + 1)
        state.equationtxt = state.history[state.history_idx]
        state.equationlabel.set(state.equationtxt)