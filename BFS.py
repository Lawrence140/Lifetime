from collections import deque
import copy
# fuction to split string into a board
def makeBoard(boardString)->list:
    return [list(boardString[i:i+3]) for i in range(0,len(boardString),3)]

# fucntion to turn board to string
def makeString(board)->str:
    str = ""
    for i in range(3):
        for j in range(3):
            str+=board[i][j]
    return str

# function to check is move is valid
def isValid(newX,newY):
    if (0<=newX<3 and 0<=newY<3):
        return True
    return False

# function to make move and return board after move
def makeMove(board,action)->str:
    # moving horizonatally
    if(action == "LEFT" or action == "RIGHT"):
        for i in range(3):
            for j in range(3):
                if(board[i][j] == "#"):
                    spaceY,spaceX = i,j
                    if(action == "LEFT"):
                        onY,onX = i,j-1
                        if(isValid(onY,onX)):
                            newBoard = [row[:] for row in board]
                            temp = newBoard[onY][onX]
                            newBoard[onY][onX] = "#"
                            newBoard[i][j] = temp
                            return newBoard,makeString(newBoard)
                    else:
                        onY,onX = i,j+1
                        if(isValid(onY,onX)):
                            newBoard = [row[:] for row in board]
                            temp = newBoard[onY][onX]
                            newBoard[onY][onX] = "#"
                            newBoard[i][j] = temp
                            return newBoard,makeString(newBoard)
    # moving vertically
    elif(action == "UP" or action == "DOWN"):
        for i in range(3):
            for j in range(3):
                if(board[i][j] == "#"):
                    spaceY,spaceX = i,j
                    if(action == "UP"):
                        onY,onX = i-1,j
                        if(isValid(onY,onX)):
                            newBoard = [row[:] for row in board]
                            temp = newBoard[onY][onX]
                            newBoard[onY][onX] = "#"
                            newBoard[i][j] = temp
                            return newBoard,makeString(newBoard)
                    else:
                        onY,onX = i+1,j
                        if(isValid(onY,onX)):
                            newBoard = [row[:] for row in board]
                            temp = newBoard[onY][onX]
                            newBoard[onY][onX] = "#"
                            newBoard[i][j] = temp
                            return newBoard,makeString(newBoard)

def availActions(board):
    actions = {"UP":(-1,0),"DOWN":(1,0),"LEFT":(0,-1),"RIGHT":(0,1)}
    avail = []
    for i in range(3):
        for j in range(3):
            if(board[i][j]=="#"):
                spaceY,spaceX = i,j
    for key in actions:
        moveY,moveX = actions[key][0],actions[key][1]
        newY,newX = spaceY+moveY,spaceX+moveX
        if(isValid(newY,newX)):
            avail.append(key)
    return avail

def printActions(actions):
    for i in actions:
        print(i)


# fuction to print board to debug
def printBoard(board):
    for row in board:
        print(row)

def BFS(initBoard,goalBoard)->int:
    startState = makeString(initBoard)
    goalState = makeString(goalBoard)
    if startState == goalState:
        return 0,startState
    else:
        frontier = deque()
        frontier.append((startState,0))
        explored = set()
        explored.add(startState)
        while(len(frontier)>0):
            toExplore, depth = frontier.popleft()
            currBoard = makeBoard(toExplore)
            for action in availActions(currBoard):
                newBoard,newState = makeMove(currBoard,action)
                if newState == goalState:
                        return depth+1,newState
                if newState not in explored:
                    explored.add(newState)
                    frontier.append((newState,depth+1))
        return -1,None

# main function to set up parameters
def main():
    boardString = input("Enter given board string: ")
    goalString = input("Enter given goal state: ")
    # making a move
    # newBoard,newString = makeMove(board,action)
    
    # get available actions
    # actions = availActions(board)

    # perform BFS
    initBoard,goalBoard = makeBoard(boardString),makeBoard(goalString)
    numberOfMoves,goalState = BFS(initBoard,goalBoard)

    print(f'Solved in {numberOfMoves} and goal state is {makeBoard(goalState)}')

if __name__ == "__main__":
    main()