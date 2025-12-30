import random
import time
import matplotlib.pyplot as plt

def LinearSearch(myList,key):
    idx = 0
    while(idx<len(myList)):
        if myList[idx]==key:
            return True
        idx+=1
    return False

def makeMyList(n_size):
    n_size-=1
    counter = 0
    myList = []
    while (counter!=n_size):
        k = random.randint(0,n_size-1)
        if not LinearSearch(myList,k):
            myList.append(k)
            counter+=1
    return myList


def bestCase(n_size):
    myList = makeMyList(n_size)
    key = random.choice(myList)
    myList.remove(key)
    myList.insert(0,key)

    start = time.perf_counter() 
    found = LinearSearch(myList,key)
    end =  time.perf_counter()
    
    if not found:
        return None
    return end-start

def averageCase(n_size):
    myList = makeMyList(n_size)
    key = random.choice(myList)

    start = time.perf_counter()
    found = LinearSearch(myList,key)
    end = time.perf_counter()

    if not found:
        return None
    return end-start

def worstCase(n_size):
    myList = makeMyList(n_size)
    key = random.choice(myList)
    myList.remove(key)
    myList.append(key)
    
    start = time.perf_counter()
    found = LinearSearch(myList,key)
    end = time.perf_counter()
    if not found:
        return None
    return end-start

def plotInfo(times,n_sizes,case):
    plt.plot(n_sizes,times)
    plt.xlabel("Size of list")
    plt.ylabel("Time take in seconds")
    plt.title(f"Linear Search track for the {case}")
    plt.show()
    pass

def experiments():
    n_sizes = [1000,2000,3000,4000,5000]
    BCtimes = []
    ACtimes = []
    WCtimes = []
    for i in range(len(n_sizes)):
        BCtimes.append(bestCase(n_sizes[i]))
        ACtimes.append(averageCase(n_sizes[i]))
        WCtimes.append(worstCase(n_sizes[i]))
    plotInfo(BCtimes,n_sizes,"best case")
    plotInfo(ACtimes,n_sizes,"average case")
    plotInfo(WCtimes,n_sizes,"worst case")
    return BCtimes

def main():
    experiments()

if __name__ == "__main__":
    main()