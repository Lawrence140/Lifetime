# my binarySearch
import math

def binarySearch(myList,key):
    # must be reccursive 
    
    # base case
    
    # reccursive call on the side that most likly have the key
    pass


def makeList():
    randomList = [10,21,29,42,61,92,99]
    return randomList

def main():
    # start here
    makeList = makeList()
    key = 92
    results = binarySearch(myList,key)
    if (results==True):
        print(f"The key {key} was found in the list succes! ")
    else:
        print(f"The key {key} was not found in the list fail! ")
    pass

if __name__ == "__main__":
    main()