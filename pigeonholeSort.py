# sorting algo

def pigenholeSort(myList,n,maX):
    hole = []
    
    for j in range(0,maX+1):
        hole.append(0)

    for i in range(0,n):
        t = myList[i]
        hole[t] += 1
    
    idx=0

    for j in range(0,maX+1):
        if hole[j]>0:
            for k in range(hole[j]):
                myList[idx] = j
                idx+=1
    return myList

def main():
    myList = [9,5,8,20,13]
    Max = 20
    N = len(myList)
    sortedList = pigenholeSort(myList,N,Max)
    print(f"sorted list {sortedList}")
if __name__ == "__main__":
    main()