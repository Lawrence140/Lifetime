from BFS import isValid,makeBoard,makeString,makeMove,availActions,printBoard
import heapq

def actionCost(action):
    actCost = {"UP":1,"DOWN":1,"LEFT":1,"RIGHT":1}
    return actCost[action]

def manhattenDistancne(startState,goalState):
    distance = 0
    for idx,tile in enumerate(startState):
        if tile!="#":
            goalIdx = goalState.index(tile)
            x1,y1 = divmod(idx,3)
            x2,y2 = divmod(goalIdx,3)
            distance+=abs(x1-x2)+abs(y1-y2)
    return distance

def GBFS(startState,goalState):
    if startState==goalState:
        return 0
    frontier = []
    visited = set()
    heapq.heappush(frontier,(manhattenDistancne(startState,goalState),startState,0))
    visited.add(startState)
    while (len(frontier)>0):
        cost,initState,depth = heapq.heappop(frontier)
        if initState==goalState:
            return depth
        currBoard = makeBoard(initState)
        for action in availActions(currBoard):
            newBoard,newState = makeMove(currBoard,action)
            if newState not in visited:
                visited.add(newState)
                heapq.heappush(frontier,(manhattenDistancne(newState,goalState),newState,depth+1))
    return None

def main():
    startState = input("Enter the start state: ")
    goalState = input("Enter goal state: ")
    nMoves = GBFS(startState,goalState)
    print(f"solve in {nMoves}")

if __name__ == "__main__":
    main()