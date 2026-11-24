// Formato único usado pelo app, independente da versão da ExerciseDB (v1 ou v2)
export interface ExerciseMedia {
  id: string
  name: string
  videoUrl: string | null
  imageUrl: string | null
  targets: string[]
  secondary: string[]
  equipments: string[]
  bodyParts: string[]
  overview: string | null
  instructions: string[]
  tips: string[]
  variations: string[]
}
