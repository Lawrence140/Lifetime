from BFS import isValid,makeBoard,makeString,makeMove,availActions,printBoard
import heapq
def actionCost(action):
    actCost = {"UP":5,"DOWN":1,"LEFT":1,"RIGHT":1}
    return actCost[action]

def UCS(startState,goalState):
    if startState==goalState:
        return 0,0
    else:
        frontier = []
        heapq.heappush(frontier,(0,startState))
        visited = {}
        expansion = 0
        while(frontier):
            cost,initState = heapq.heappop(frontier)
            if initState in visited and visited[initState]<=cost:
                continue
            visited[initState] = cost
            if initState==goalState:
                return cost,expansion
            expansion+=1
            currBoard = makeBoard(initState)
            for action in availActions(currBoard):
                newBoard,newState = makeMove(currBoard,action)
                moveCost = actionCost(action)
                newCost = moveCost+cost
                if newState not in visited or newCost <visited[newState]:
                    heapq.heappush(frontier,(newCost,newState))
        return None,expansion

def main():
    startState = input("Enter start start: ")
    goalState = input("Enter goal state: ")
    moves,expansio = UCS(startState,goalState)
    print(moves)

if __name__ == "__main__":
    main()