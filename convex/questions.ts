export const questionBank = [
  {
    type: "optimal_approach",
    question:
      "What is the most optimal general approach for finding two numbers in an unsorted array that sum to a target?",
    choices: [
      "Nested Loops",
      "Hash Map",
      "Binary Search",
      "Dynamic Programming",
    ],
    correctAnswer: 1,
  },
  {
    type: "optimal_approach",
    question:
      "Given a sorted array, what is the most optimal approach to find two numbers that sum to a target?",
    choices: [
      "Two Pointers",
      "Nested Loops",
      "DFS",
      "Dynamic Programming",
    ],
    correctAnswer: 0,
  },
  {
    type: "complexity",
    question:
      "What is the average time complexity of searching for a value in a hash map?",
    choices: [
      "O(1)",
      "O(log n)",
      "O(n)",
      "O(n²)",
    ],
    correctAnswer: 0,
  },
  {
    type: "data_structure",
    question:
      "Which data structure is usually best for implementing Breadth First Search?",
    choices: [
      "Stack",
      "Queue",
      "Hash Set",
      "Heap",
    ],
    correctAnswer: 1,
  },
  {
    type: "complexity",
    question:
      "What is the time complexity of binary search?",
    choices: [
      "O(1)",
      "O(log n)",
      "O(n)",
      "O(n log n)",
    ],
    correctAnswer: 1,
  },
  {
    type: "optimal_approach",
    question:
      "Which approach is typically best for detecting duplicates in an unsorted array in O(n) time?",
    choices: [
      "Nested Loops",
      "Hash Set",
      "Binary Search",
      "Bubble Sort",
    ],
    correctAnswer: 1,
  },
  {
    type: "optimal_approach",
    question:
      "Which technique is commonly used for problems involving contiguous subarrays or substrings?",
    choices: [
      "Sliding Window",
      "Binary Tree",
      "Heap Sort",
      "Union Find",
    ],
    correctAnswer: 0,
  },
  {
    type: "data_structure",
    question:
      "What data structure is most useful when repeatedly retrieving the smallest or largest element?",
    choices: [
      "Queue",
      "Linked List",
      "Heap",
      "Hash Map",
    ],
    correctAnswer: 2,
  },
  {
    type: "optimal_approach",
    question:
      "Which algorithmic technique is commonly used when a problem can be broken into overlapping subproblems?",
    choices: [
      "Dynamic Programming",
      "Binary Search",
      "Two Pointers",
      "Breadth First Search",
    ],
    correctAnswer: 0,
  },
  {
    type: "complexity",
    question:
      "What is the time complexity of traversing every element in an array once?",
    choices: [
      "O(1)",
      "O(log n)",
      "O(n)",
      "O(n²)",
    ],
    correctAnswer: 2,
  },

  // BUG HUNT
  {
    type: "bug_hunt",
    question:
      "What is wrong with this Two Sum implementation?",
    code: `def twoSum(nums, target):
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num

        if complement in seen:
            return [i, seen[complement]]

        seen[num] = i`,
    choices: [
      "The dictionary lookup is invalid",
      "The returned indices are reversed",
      "enumerate() cannot be used here",
      "The runtime is O(n²)",
    ],
    correctAnswer: 1,
  },

  {
    type: "bug_hunt",
    question:
      "What bug causes this binary search to potentially miss the target?",
    code: `def search(nums, target):
    left = 0
    right = len(nums) - 1

    while left < right:
        mid = (left + right) // 2

        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1`,
    choices: [
      "mid should use division instead of //",
      "The loop condition should allow left == right",
      "right should start at len(nums)",
      "Binary search cannot use indexes",
    ],
    correctAnswer: 1,
  },

  {
    type: "edge_case",
    question:
      "Which edge case should you consider when solving a maximum subarray problem?",
    choices: [
      "The array contains only negative numbers",
      "The array is already sorted",
      "The array contains duplicate indexes",
      "The array uses floating-point indexes",
    ],
    correctAnswer: 0,
  },
];