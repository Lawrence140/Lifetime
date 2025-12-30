# finding the largest element in a list
import time
def largestA(myList,N):
    while N>1:
        pos = 0
        posN = -1
        while pos<N-1:
            posN = posN+1
            if (myList[pos]>myList[pos+1]):
                myList[posN] = myList[pos]
            else:
                myList[posN] = myList[pos+1]
            pos+=2
        if (pos == N-1):
            posN = posN+1
            myList[posN] = myList[pos]
        N = posN + 1
    return myList[0]

def main():
    myList = [18,17,21,33,42]
    start = time.perf_counter() 
    result = largestA(myList,N=len(myList))
    end = time.perf_counter()-start
    print(f"The largest value is {result} found in {end}")

if __name__ == "__main__":
    main()